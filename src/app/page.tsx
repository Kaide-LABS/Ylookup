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

  // Demo Auto-Advance Toggle
  const [autoAdvance, setAutoAdvance] = useState(true);

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
      
      // Auto-scroll to export panel slightly after completion
      setTimeout(() => {
         window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 500);

    } catch (err: any) {
      setError(err.message || "An error occurred during the confidence audit");
    } finally {
      setIsAuditing(false);
    }
  };

  // Auto-advance logic
  useEffect(() => {
    if (autoAdvance) {
      if (results && !normalizedData && !isNormalizing && !error) {
        // Give the user a moment to see the extraction before normalizing
        const timer = setTimeout(() => handleNormalize(results.tables), 1500);
        return () => clearTimeout(timer);
      }
      
      if (normalizedData && !auditedData && !isAuditing && !error) {
        // Give the user a moment to see the mapping before auditing
        const timer = setTimeout(() => handleAudit(normalizedData.normalized_tables), 1500);
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, normalizedData, auditedData, isNormalizing, isAuditing, error, autoAdvance]);

  const handleReviewAction = (action: ReviewAction) => {
    addAction(action);
    setAuditActions(getActions());

    if (action.type === "edit" && action.new_value) {
      // Optimistic state update only for demo purposes
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
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto relative">
        
        {/* Header */}
        <div className="text-center mb-12 relative z-10">
          <div className="flex justify-center items-center gap-3 mb-2">
             <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-black shadow-lg">
                ⚡
             </div>
             <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
               UDINA
             </h1>
          </div>
          <p className="mt-3 text-xl text-gray-500 font-medium">
            Financial Document Intelligence
          </p>
          
          <button 
             onClick={() => setAutoAdvance(!autoAdvance)}
             className={`mt-4 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${autoAdvance ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
          >
             <RefreshCw className={`w-3 h-3 ${autoAdvance ? 'animate-spin-slow' : ''}`} />
             Auto-Advance Demo Mode: {autoAdvance ? "ON" : "OFF"}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <motion.div initial="hidden" animate="visible" variants={fadeUpVariant} className="max-w-2xl mx-auto mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-md shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
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

        {/* Global Pipeline Progress */}
        <AnimatePresence>
          {currentPhase !== "pending" && (
            <motion.div 
               initial={{ opacity: 0, height: 0 }} 
               animate={{ opacity: 1, height: 'auto' }} 
               className="sticky top-4 z-40 bg-gray-50/90 backdrop-blur-md pt-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
            >
              <PipelineProgress currentPhase={currentPhase as any} />
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
            {/* Top Toolbar */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 sticky top-32 z-30">
              <button
                onClick={() => { setResults(null); setNormalizedData(null); setAuditedData(null); setJobId(null); }}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-2"
              >
                &larr; Start New Document
              </button>
              
              {!normalizedData && !isNormalizing && !autoAdvance && (
                <button
                  onClick={() => handleNormalize(results.tables)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  Step 2: Normalize to GAAP
                </button>
              )}
            </div>
            
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
                <div className="flex justify-end mb-4">
                  {!auditedData && !isAuditing && !autoAdvance && (
                    <button
                      onClick={() => handleAudit(normalizedData.normalized_tables)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                      Step 3: Audit Confidence
                    </button>
                  )}
                </div>
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