"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import UploadZone from "@/components/UploadZone";
import ProcessingStatus from "@/components/ProcessingStatus";
import ExtractionResults from "@/components/ExtractionResults";
import MappingView from "@/components/MappingView";
import ConfidenceHeatmap from "@/components/ConfidenceHeatmap";
import ReviewPanel from "@/components/ReviewPanel";
import { CellScore, ReviewAction, addAction, getActions } from "@/lib/audit-trail";

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Phase 2 State
  const [normalizedData, setNormalizedData] = useState<any | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);

  // Phase 3 State
  const [auditedData, setAuditedData] = useState<any | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<CellScore | null>(null);
  const [auditActions, setAuditActions] = useState<ReviewAction[]>([]);
  const [activeTableIndex, setActiveTableIndex] = useState(0);

  const handleUploadStart = (id: string) => {
    setJobId(id);
    setError(null);
    setResults(null);
    setNormalizedData(null);
    setAuditedData(null);
  };

  const handleComplete = (data: any) => {
    setResults(data);
    setJobId(null);
  };

  const handleError = (errMsg: string) => {
    setError(errMsg);
    setJobId(null);
    setIsNormalizing(false);
    setIsAuditing(false);
  };

  const handleNormalize = async () => {
    if (!results || !results.tables) return;
    
    setIsNormalizing(true);
    setError(null);
    
    try {
      const res = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: results.tables }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to normalize data");
      }
      
      setNormalizedData(data);
    } catch (err: any) {
      setError(err.message || "An error occurred during normalization");
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleAudit = async () => {
    if (!normalizedData || !normalizedData.normalized_tables) return;

    setIsAuditing(true);
    setError(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ normalized_tables: normalizedData.normalized_tables }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to audit data");
      }

      setAuditedData(data);
    } catch (err: any) {
      setError(err.message || "An error occurred during the confidence audit");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleReviewAction = (action: ReviewAction) => {
    addAction(action);
    setAuditActions(getActions());

    if (action.type === "edit" && action.new_value) {
      // Update the audited_html by replacing the cell text via string replacement
      // targeted by row/col data attributes to avoid false matches
      const newData = JSON.parse(JSON.stringify(auditedData));
      const table = newData.audited_tables[activeTableIndex];
      if (table?.audited_html) {
        // Find the cell by its data attributes and replace its text content
        const pattern = new RegExp(
          `(data-row="${action.cell.row_index}"[^>]*data-col="${action.cell.col_index}"[^>]*>)[^<]*(<)`,
        );
        table.audited_html = table.audited_html.replace(pattern, `$1${action.new_value}$2`);
        // Also update the cell_scores entry
        const scoreIdx = table.cell_scores.findIndex(
          (s: CellScore) => s.row_index === action.cell.row_index && s.col_index === action.cell.col_index
        );
        if (scoreIdx !== -1) {
          table.cell_scores[scoreIdx].cell_text = action.new_value;
        }
      }
      setAuditedData(newData);
    }

    setSelectedCell(null);
  };

  const handleMappingOverride = (tableIndex: number, originalTerm: string, newCanonical: string) => {
     console.log(`Override term: ${originalTerm} -> ${newCanonical} in table ${tableIndex}`);
     // Here you would trigger an API call to re-generate the HTML with the forced mapping
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
            UDINA
          </h1>
          <p className="mt-3 text-xl text-gray-500 sm:mt-4">
            Financial Document Intelligence
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!jobId && !results && !isNormalizing && !isAuditing && (
          <UploadZone onUploadStart={handleUploadStart} onError={handleError} />
        )}

        {jobId && (
          <ProcessingStatus jobId={jobId} onComplete={handleComplete} onError={handleError} />
        )}

        {results && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <button
                onClick={() => { setResults(null); setNormalizedData(null); setAuditedData(null); }}
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
              >
                &larr; Upload another document
              </button>
              
              {!normalizedData && !isNormalizing && (
                <button
                  onClick={handleNormalize}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Normalize to GAAP
                </button>
              )}
            </div>
            
            <ExtractionResults data={results} />
            
            {isNormalizing && (
              <ProcessingStatus statusMessage="Mapping to GAAP taxonomy..." />
            )}
            
            {normalizedData && (
              <div className="space-y-8">
                <div className="flex justify-end">
                  {!auditedData && !isAuditing && (
                    <button
                      onClick={handleAudit}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Audit Confidence
                    </button>
                  )}
                </div>
                <MappingView 
                  normalizedTables={normalizedData.normalized_tables} 
                  onOverride={handleMappingOverride}
                />
              </div>
            )}

            {isAuditing && (
              <ProcessingStatus statusMessage="Auditing cell confidence..." />
            )}

            {auditedData && (
               <ConfidenceHeatmap
                 auditedTable={auditedData.audited_tables[activeTableIndex]}
                 onCellClick={(cell) => setSelectedCell(cell)}
               />
            )}

            <AnimatePresence>
              {selectedCell && (
                <ReviewPanel
                  cellScore={selectedCell}
                  tableIndex={activeTableIndex}
                  pageNumber={auditedData?.audited_tables[activeTableIndex]?.page || 1}
                  onAction={handleReviewAction}
                  onClose={() => setSelectedCell(null)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}
