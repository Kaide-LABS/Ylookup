import { NextResponse } from "next/server";
import { gemini } from "@/lib/gemini-client";
import { GAAP_TAXONOMY } from "@/lib/gaap-ontology";
import * as cheerio from "cheerio";
import { Type } from "@google/genai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tables = body.tables || [];

    const normalized_tables = await Promise.all(
      tables.map(async (table: any) => {
        if (!table.raw_html) return { ...table, mappings: [], normalized_html: "" };

        // 1. Parse HTML securely with cheerio to extract unique terms
        const $ = cheerio.load(table.raw_html);
        const termsToMap = new Set<string>();

        // Extract text from table headers and the first cell of each row (typical row labels)
        $("th").each((_, el) => {
          const text = $(el).text().trim();
          if (text) termsToMap.add(text);
        });
        
        $("tr").each((_, row) => {
          const firstCell = $(row).find("td").first();
          if (firstCell.length) {
            const text = firstCell.text().trim();
            if (text) termsToMap.add(text);
          }
        });

        const uniqueTerms = Array.from(termsToMap);
        
        if (uniqueTerms.length === 0) {
          return { ...table, mappings: [], normalized_html: table.raw_html };
        }

        // 2. Call Gemini for mapping
        const prompt = `
          You are an expert financial accountant. I will give you a list of extracted terms from a financial document.
          Your task is to map each term to its closest equivalent in the standard GAAP Taxonomy provided.
          If a term does not correspond to a GAAP concept or shouldn't be mapped, return it as "Unmapped".
          
          CRITICAL RULE FOR SUB-ITEMS vs TOTALS:
          Financial statements often break down line items (e.g., "Net sales: Products" and "Net sales: Services") and then provide a total (e.g., "Total net sales"). 
          DO NOT map individual sub-items (like "Net sales: Products") to a generic top-level GAAP term like "Revenue" by itself, because that would create duplicate "Revenue" rows and destroy the hierarchical breakdown.
          INSTEAD, you must standardize the base GAAP term while preserving the specific sub-category descriptor. 
          For example:
          - "Net sales: Products" should map to "Revenue: Products" (or "Revenue - Products").
          - "Net sales: Services" should map to "Revenue: Services" (or "Revenue - Services").
          - "Total net sales" should map to the top-level GAAP term "Revenue".
          - "Cost of sales: Products" should map to "Cost of Goods Sold: Products".
          - "Earnings per share: Basic" should map to "Earnings Per Share: Basic".
          
          This ensures the terminology is fully standardized to GAAP (Revenue, COGS, EPS, etc.) but the granular breakdown that the founders rely on is perfectly preserved without messy inconsistencies.
          
          GAAP Taxonomy Reference:
          ${JSON.stringify(GAAP_TAXONOMY, null, 2)}
          
          Terms to map:
          ${JSON.stringify(uniqueTerms)}
        `;

        const response = await gemini.models.generateContent({
          model: "gemini-2.5-pro",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                mappings: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      original_term: { type: Type.STRING },
                      canonical_term: { type: Type.STRING },
                      category: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                      rationale: { type: Type.STRING },
                    },
                    required: ["original_term", "canonical_term", "category", "confidence", "rationale"],
                  },
                },
              },
              required: ["mappings"],
            },
            temperature: 0.1, // Keep it deterministic
          },
        });

        const mappingResultText = response.text || "{}";
        const resultJson = JSON.parse(mappingResultText);
        const mappings = resultJson.mappings || [];

        // Filter out "Unmapped" results
        const validMappings = mappings.filter((m: any) => m.canonical_term !== "Unmapped" && m.canonical_term !== m.original_term);

        // 3. Create normalized HTML securely using Cheerio
        validMappings.forEach((mapping: any) => {
          $("th, td").each((_, el) => {
            if ($(el).text().trim() === mapping.original_term) {
              $(el).text(mapping.canonical_term);
              $(el).addClass("bg-green-50 text-green-900 font-medium"); // Optional: highlight changed cells
            }
          });
        });

        return {
          ...table,
          mappings: validMappings,
          normalized_html: $.html(),
        };
      })
    );

    return NextResponse.json({ success: true, normalized_tables });
  } catch (error: any) {
    console.error("Normalization Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
