import { NextResponse } from "next/server";
import { openai } from "@/lib/openai-client";
import * as cheerio from "cheerio";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const normalized_tables = body.normalized_tables || [];

    const audited_tables = await Promise.all(
      normalized_tables.map(async (table: any) => {
        if (!table.normalized_html) return { ...table, cell_scores: [], summary: {}, audited_html: "" };

        // 1. Parse HTML to extract structured data for the LLM
        const $ = cheerio.load(table.normalized_html);
        const structuredData: any[] = [];
        let dataCellCount = 0;

        $("tr").each((rowIndex, row) => {
          const rowData: any = { row_index: rowIndex, cells: [] };
          $(row).find("th, td").each((colIndex, cell) => {
            const isHeader = cell.tagName === "th";
            const text = $(cell).text().trim();
            if (text && !isHeader) {
               dataCellCount++;
            }
            rowData.cells.push({
              col_index: colIndex,
              text,
              is_header: isHeader,
            });
          });
          structuredData.push(rowData);
        });

        if (structuredData.length === 0 || dataCellCount === 0) {
          return { ...table, cell_scores: [], summary: { total_cells: 0 }, audited_html: table.normalized_html };
        }

        // 2. Optimized Prompt: Ask GPT to return ONLY flagged cells
        const promptWithTableData = `
          You are an expert financial auditor reviewing extracted data from a financial document.
          Below is a structured representation of a normalized financial table.
          
          Your task: Review all DATA cells (ignore headers). 
          By default, assume all cells have 100% confidence. 
          Return ONLY the cells that you flag because they:
          1. Contain an anomaly (e.g., unexpected value type, wrong sign, magnitude mismatch).
          2. Are of low extraction confidence (e.g., poor OCR, strange numeric format, sub-totals that don't add up).
          
          CRITICAL FORMATTING RULE: Do NOT flag the presence of dollar signs ($) on specific rows as an anomaly or format issue. In standard GAAP financial statements, it is perfectly normal for only the top line (e.g., Net Sales) and bottom lines (e.g., Net Income, EPS) to have dollar signs, while middle rows do not. Treat this as standard formatting.

          For each flagged cell, assign a confidence score (< 95), a flag type, and a specific reason.
          If no cells have issues, return an empty array for cell_scores.
          Also provide a brief summary of any cross-reference issues found in the entire table.

          Table Data:
          ${JSON.stringify(structuredData)}
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            { role: "system", content: "You are an expert financial auditor. Follow instructions precisely." },
            { role: "user", content: promptWithTableData }
          ],
          tools: [{
            type: "function",
            function: {
              name: "score_cells",
              description: "Report flagged cells and table summary",
              parameters: {
                type: "object",
                properties: {
                  flagged_cells: {
                    type: "array",
                    description: "Array of ONLY the cells that have confidence < 95 or anomalies.",
                    items: {
                      type: "object",
                      properties: {
                        row_index: { type: "number" },
                        col_index: { type: "number" },
                        cell_text: { type: "string" },
                        confidence: { type: "number", description: "0-94" },
                        flag: { type: "string", enum: ["low_confidence", "anomaly", "format_issue"] },
                        reason: { type: "string", description: "Specific reason for the flag" }
                      },
                      required: ["row_index", "col_index", "cell_text", "confidence", "flag", "reason"]
                    }
                  },
                  summary: {
                    type: "object",
                    properties: {
                      cross_reference_issues: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of general table-wide issues (e.g., 'Total Assets does not equal Liabilities + Equity')"
                      }
                    },
                    required: ["cross_reference_issues"]
                  }
                },
                required: ["flagged_cells", "summary"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "score_cells" } }
        });

        // 3. Parse tool call response
        const toolCall = response.choices[0].message.tool_calls?.[0];
        let result = { flagged_cells: [], summary: { cross_reference_issues: [] } };
        if (toolCall) {
            try {
                result = JSON.parse((toolCall as any).function.arguments);
            } catch (e) {
                console.error("Failed to parse OpenAI response", e);
            }
        }
        
        const flaggedCells = (result.flagged_cells || []).filter(
          (c: any) => !/dollar\s*sign/i.test(c.reason || "")
        );
        const flaggedMap = new Map();
        flaggedCells.forEach((c: any) => {
            flaggedMap.set(`${c.row_index}-${c.col_index}`, c);
        });

        // 4. Build audited HTML: inject CSS classes & data attributes directly via Cheerio
        let totalConfidence = 0;
        
        $("tr").each((rowIndex, row) => {
          $(row).find("th, td").each((colIndex, cell) => {
            if (cell.tagName === "th") return; // skip headers
            
            const cellText = $(cell).text().trim();
            if (!cellText) return;
            
            const key = `${rowIndex}-${colIndex}`;
            const flagData = flaggedMap.get(key);
            
            let confidence = 100;
            if (flagData) {
               confidence = flagData.confidence;
               // Inject data attributes so the frontend can catch click events
               $(cell).attr("data-row", String(rowIndex));
               $(cell).attr("data-col", String(colIndex));
               $(cell).attr("data-confidence", String(confidence));
               $(cell).attr("data-flag", flagData.flag);
               $(cell).attr("data-reason", flagData.reason);
               $(cell).addClass("cursor-pointer transition-colors duration-200");
               
               if (confidence < 80) {
                 $(cell).attr("style", "background-color: rgba(239,68,68,0.15); border-left: 4px solid #ef4444; cursor: pointer;");
               } else {
                 $(cell).attr("style", "background-color: rgba(245,158,11,0.15); border-left: 4px solid #f59e0b; cursor: pointer;");
               }
            }
            totalConfidence += confidence;
          });
        });

        const avgConfidence = dataCellCount > 0 ? (totalConfidence / dataCellCount) : 100;

        return {
          ...table,
          cell_scores: flaggedCells, // We only pass the exceptions to the client to save bandwidth
          summary: {
            total_cells: dataCellCount,
            flagged_count: flaggedCells.length,
            average_confidence: avgConfidence,
            cross_reference_issues: result.summary?.cross_reference_issues || []
          },
          audited_html: $.html(),
        };
      })
    );

    return NextResponse.json({ success: true, audited_tables });
  } catch (error: any) {
    console.error("Audit Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
