import { NextResponse } from "next/server";
import { gemini } from "@/lib/gemini-client";
import { GAAP_TAXONOMY } from "@/lib/gaap-ontology";
import * as cheerio from "cheerio";
import { Type } from "@google/genai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tables = body.tables || [];

    // Step 1: Extract ALL unique terms from ALL tables (local, instant)
    const allTerms = new Set<string>();
    const parsedTables = tables.map((table: any) => {
      if (!table.raw_html) return { table, $: null, terms: [] };
      const $ = cheerio.load(table.raw_html);
      const terms: string[] = [];

      $("th").each((_, el) => {
        const text = $(el).text().trim();
        if (text) { allTerms.add(text); terms.push(text); }
      });

      $("tr").each((_, row) => {
        const firstCell = $(row).find("td").first();
        if (firstCell.length) {
          const text = firstCell.text().trim();
          if (text) { allTerms.add(text); terms.push(text); }
        }
      });

      return { table, $, terms };
    });

    const uniqueTerms = Array.from(allTerms);

    if (uniqueTerms.length === 0) {
      return NextResponse.json({
        success: true,
        normalized_tables: tables.map((t: any) => ({ ...t, mappings: [], normalized_html: t.raw_html || "" })),
      });
    }

    // Step 2: ONE Gemini call to map ALL terms at once
    const prompt = `
      You are an expert financial accountant. Map each term below to its closest GAAP equivalent.
      If a term does not correspond to a GAAP concept, return canonical_term as "Unmapped".

      CRITICAL RULE FOR SUB-ITEMS vs TOTALS:
      - "Net sales: Products" → "Revenue: Products" (preserve sub-category)
      - "Net sales: Services" → "Revenue: Services"
      - "Total net sales" → "Revenue" (top-level)
      - "Cost of sales: Products" → "Cost of Goods Sold: Products"
      - "Earnings per share: Basic" → "Earnings Per Share: Basic"
      Standardize to GAAP but preserve granular breakdowns.

      GAAP Taxonomy:
      ${JSON.stringify(GAAP_TAXONOMY, null, 2)}

      Terms to map (${uniqueTerms.length} total):
      ${JSON.stringify(uniqueTerms)}
    `;

    let mappings: any[] = [];

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await gemini.models.generateContent({
          model: "gemini-3-flash-preview",
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
            temperature: 0.1,
          },
        });

        const resultJson = JSON.parse(response.text || "{}");
        mappings = resultJson.mappings || [];
        break;
      } catch (err: any) {
        console.warn(`Normalization attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt === 2) {
          console.error("All normalization attempts failed, returning tables unmapped");
          return NextResponse.json({
            success: true,
            normalized_tables: tables.map((t: any) => ({ ...t, mappings: [], normalized_html: t.raw_html || "" })),
          });
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Build a lookup map: original_term -> mapping
    const validMappings = mappings.filter(
      (m: any) => m.canonical_term !== "Unmapped" && m.canonical_term !== m.original_term
    );
    const mappingLookup = new Map(validMappings.map((m: any) => [m.original_term, m]));

    // Step 3: Apply mappings to each table locally (instant, no API calls)
    const normalized_tables = parsedTables.map(({ table, $, terms }: any) => {
      if (!$ || terms.length === 0) {
        return { ...table, mappings: [], normalized_html: table.raw_html || "" };
      }

      const tableMappings: any[] = [];

      $("th, td").each((_: any, el: any) => {
        const text = $(el).text().trim();
        const mapping = mappingLookup.get(text);
        if (mapping) {
          $(el).text(mapping.canonical_term);
          $(el).addClass("bg-green-50 text-green-900 font-medium");
          tableMappings.push(mapping);
        }
      });

      return {
        ...table,
        mappings: tableMappings,
        normalized_html: $.html(),
      };
    });

    return NextResponse.json({ success: true, normalized_tables });
  } catch (error: any) {
    console.error("Normalization Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
