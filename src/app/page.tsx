"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";
import UploadZone from "@/components/UploadZone";
import ProcessingStatus from "@/components/ProcessingStatus";
import ExtractionResults from "@/components/ExtractionResults";
import MappingView from "@/components/MappingView";
import ConfidenceHeatmap from "@/components/ConfidenceHeatmap";
import ReviewPanel from "@/components/ReviewPanel";
import PipelineProgress from "@/components/PipelineProgress";
import ExportPanel from "@/components/ExportPanel";
import { CellScore, ReviewAction, addAction, getActions, clearAuditTrail } from "@/lib/audit-trail";

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

  // Determine current pipeline phase
  const currentPhase = auditedData ? "complete" :
                       (isAuditing || (normalizedData && !isNormalizing)) ? "audit" :
                       (isNormalizing || (results && !isNormalizing)) ? "normalize" :
                       (jobId || isNormalizing) ? "extract" : "pending";

  const handleUploadStart = (id: string) => {
    setJobId(id);
    setError(null);
    setResults(null);
    setNormalizedData(null);
    setAuditedData(null);
    clearAuditTrail();
    setAuditActions([]);
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

  const handleNormalize = async (tablesToNormalize = results?.tables) => {
    if (!tablesToNormalize) return;

    setIsNormalizing(true);
    setError(null);

    try {
      const res = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: tablesToNormalize }),
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

  const handleAudit = async (tablesToAudit = normalizedData?.normalized_tables) => {
    if (!tablesToAudit) return;

    setIsAuditing(true);
    setError(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ normalized_tables: tablesToAudit }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to audit data");
      }

      setAuditedData(data);

      setTimeout(() => {
         window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 500);

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
      console.log(`Cell updated to: ${action.new_value}`);
    }

    setSelectedCell(null);
  };

  const handleMappingOverride = (tableIndex: number, originalTerm: string, newCanonical: string) => {
     console.log(`Override term: ${originalTerm} -> ${newCanonical} in table ${tableIndex}`);
  };

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <main className="min-h-screen bg-yl-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto relative">

        {/* Header */}
        <div className="text-center mb-12 relative z-10">
          <div className="flex justify-center items-center gap-3 mb-2">
             <img src="/ylookup_logo.jpeg" alt="Ylookup" className="w-12 h-12 rounded-xl shadow-lg shadow-green-500/20" />
             <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
               UDINA
             </h1>
          </div>
          <p className="mt-3 text-xl text-gray-400 font-medium">
            Financial Document Intelligence
          </p>
          <p className="mt-1 text-sm text-green-400/70 font-medium tracking-wide">
            powered by Ylookup
          </p>
        </div>

        {/* Error State */}
        {error && (
          <motion.div initial="hidden" animate="visible" variants={fadeUpVariant} className="max-w-2xl mx-auto mb-8 bg-red-500/10 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-300">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Upload Zone */}
        {!jobId && !results && !isNormalizing && !isAuditing && (
          <motion.div initial="hidden" animate="visible" variants={fadeUpVariant}>
            <UploadZone onUploadStart={handleUploadStart} onError={handleError} />
          </motion.div>
        )}

        {/* Floating Pipeline Header */}
        <AnimatePresence>
          {currentPhase !== "pending" && (
            <motion.div
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: 'auto' }}
               className="sticky top-0 z-40 bg-yl-bg/95 backdrop-blur-md pt-4 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-yl-border"
            >
              <PipelineProgress currentPhase={currentPhase as any} />
              {results && (
                <div className="flex justify-between items-center max-w-3xl mx-auto mt-2 px-2">
                  <button
                    onClick={() => { setResults(null); setNormalizedData(null); setAuditedData(null); setJobId(null); }}
                    className="text-xs text-green-400 hover:text-green-300 font-semibold flex items-center gap-1"
                  >
                    &larr; New Document
                  </button>
                  {!normalizedData && !isNormalizing && (
                    <button
                      onClick={() => handleNormalize(results.tables)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-md text-white bg-green-600 hover:bg-green-500 transition-colors"
                    >
                      Step 2: Normalize to GAAP
                    </button>
                  )}
                  {normalizedData && !auditedData && !isAuditing && (
                    <button
                      onClick={() => handleAudit(normalizedData.normalized_tables)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-md text-white bg-green-600 hover:bg-green-500 transition-colors"
                    >
                      Step 3: Audit Confidence
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Extraction Progress */}
        {jobId && (
          <ProcessingStatus jobId={jobId} onComplete={handleComplete} onError={handleError} />
        )}

        {/* Results Container */}
        {results && (
          <div className="space-y-12 pb-24">
            {/* Phase 1: Extraction */}
            <motion.div initial="hidden" animate="visible" variants={fadeUpVariant} viewport={{ once: true }}>
               <ExtractionResults data={results} />
            </motion.div>

            {/* Phase 2: Normalization */}
            {isNormalizing && (
              <ProcessingStatus statusMessage="Mapping to GAAP taxonomy..." />
            )}

            {normalizedData && (
              <motion.div initial="hidden" animate="visible" variants={fadeUpVariant} viewport={{ once: true }}>
                <MappingView
                  normalizedTables={normalizedData.normalized_tables}
                  onOverride={handleMappingOverride}
                />
              </motion.div>
            )}

            {/* Phase 3: Audit */}
            {isAuditing && (
              <ProcessingStatus statusMessage="Auditing cell confidence via AI..." />
            )}

            {auditedData && (
               <motion.div initial="hidden" animate="visible" variants={fadeUpVariant} viewport={{ once: true }}>
                 <ConfidenceHeatmap
                   auditedTable={auditedData.audited_tables[activeTableIndex]}
                   onCellClick={(cell) => setSelectedCell(cell)}
                 />
               </motion.div>
            )}

            {/* Phase 4: Export Panel */}
            {auditedData && (
               <ExportPanel
                 auditedData={auditedData}
                 extractionResults={results}
                 auditActions={auditActions}
               />
            )}

            {/* Slide-in HITL Review Panel */}
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
