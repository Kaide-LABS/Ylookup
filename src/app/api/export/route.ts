import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { format, audited_tables, audit_trail = [], document_type, metadata } = body;

    if (format === "json") {
      const jsonOutput = {
        schema_version: "1.0",
        document_type: document_type || "unknown",
        exported_at: new Date().toISOString(),
        source: "UDINA v1.0",
        tables: audited_tables.map((table: any) => {
          const $ = cheerio.load(table.audited_html);
          const headers: string[] = [];
          const rows: any[] = [];

          // Extract headers
          $("th").each((_, el) => {
            headers.push($(el).text().trim());
          });

          // Extract rows
          $("tr").each((rowIndex, tr) => {
            const hasHeaders = $(tr).find("th").length > 0;
            if (hasHeaders) return; // Skip header rows

            const rowObj: any = {};
            $(tr).find("td").each((colIndex, td) => {
              const headerName = headers[colIndex] || `Column_${colIndex}`;
              const cellText = $(td).text().trim();
              const confidence = parseFloat($(td).attr("data-confidence") || "100");
              const flag = $(td).attr("data-flag") || "none";
              
              // Check audit trail for this specific cell
              const cellActions = audit_trail.filter(
                (a: any) => a.table_index === table.table_index && a.cell.row_index === rowIndex && a.cell.col_index === colIndex
              );
              const lastAction = cellActions.length > 0 ? cellActions[cellActions.length - 1] : null;

              rowObj[headerName] = {
                value: lastAction && lastAction.type === "edit" ? lastAction.new_value : cellText,
                confidence,
                flag,
                reviewed: !!lastAction,
                review_action: lastAction ? lastAction.type : undefined,
                original_value: lastAction && lastAction.type === "edit" ? cellText : undefined
              };
            });
            
            if (Object.keys(rowObj).length > 0) {
              rows.push(rowObj);
            }
          });

          return {
            page: table.page,
            table_index: table.table_index,
            headers,
            rows,
            field_mappings: table.mappings || [],
            summary: table.summary
          };
        }),
        audit_trail: audit_trail,
        metadata: {
          ...metadata,
          total_tables: audited_tables.length,
          total_reviewed: audit_trail.length
        }
      };

      return new NextResponse(JSON.stringify(jsonOutput, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="udina_export_${document_type}_${Date.now()}.json"`
        }
      });
    } 
    
    if (format === "csv") {
      let csvStr = "Page,Table_Index,Row_Index,Field,Value,Confidence,Flag,Reviewed,Review_Action\n";
      
      audited_tables.forEach((table: any) => {
        const $ = cheerio.load(table.audited_html);
        const headers: string[] = [];
        
        $("th").each((_, el) => { headers.push($(el).text().trim()); });

        $("tr").each((rowIndex, tr) => {
          if ($(tr).find("th").length > 0) return;

          $(tr).find("td").each((colIndex, td) => {
             const headerName = headers[colIndex] || `Column_${colIndex}`;
             let cellText = $(td).text().trim();
             const confidence = parseFloat($(td).attr("data-confidence") || "100");
             const flag = $(td).attr("data-flag") || "none";
             
             const cellActions = audit_trail.filter(
                (a: any) => a.table_index === table.table_index && a.cell.row_index === rowIndex && a.cell.col_index === colIndex
             );
             const lastAction = cellActions.length > 0 ? cellActions[cellActions.length - 1] : null;
             
             if (lastAction && lastAction.type === "edit") {
                 cellText = lastAction.new_value;
             }
             
             // Escape quotes for CSV
             const escapedField = `"${headerName.replace(/"/g, '""')}"`;
             const escapedValue = `"${cellText.replace(/"/g, '""')}"`;
             const reviewed = lastAction ? "true" : "false";
             const reviewAction = lastAction ? lastAction.type : "";

             csvStr += `${table.page},${table.table_index},${rowIndex},${escapedField},${escapedValue},${confidence},${flag},${reviewed},${reviewAction}\n`;
          });
        });
      });

      csvStr += "\n--- Audit Trail ---\n";
      csvStr += "Timestamp,Table,Row,Col,Action,Original_Value,New_Value,Note\n";
      
      audit_trail.forEach((a: any) => {
          const orig = `"${a.cell.cell_text.replace(/"/g, '""')}"`;
          const val = a.new_value ? `"${a.new_value.replace(/"/g, '""')}"` : "";
          const note = a.reviewer_note ? `"${a.reviewer_note.replace(/"/g, '""')}"` : "";
          csvStr += `${a.timestamp},${a.table_index},${a.cell.row_index},${a.cell.col_index},${a.type},${orig},${val},${note}\n`;
      });

      return new NextResponse(csvStr, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="udina_export_${document_type}_${Date.now()}.csv"`
        }
      });
    }

    return NextResponse.json({ success: false, error: "Invalid format" }, { status: 400 });

  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
