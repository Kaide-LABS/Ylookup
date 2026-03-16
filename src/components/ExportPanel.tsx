"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileJson, FileSpreadsheet, Download, ShieldCheck } from "lucide-react";
import { ReviewAction, exportAuditTrail } from "@/lib/audit-trail";

interface ExportPanelProps {
  auditedData: any;
  extractionResults: any;
  auditActions: ReviewAction[];
}

export default function ExportPanel({ auditedData, extractionResults, auditActions }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState<"json" | "csv" | null>(null);

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(format);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          audited_tables: auditedData.audited_tables,
          audit_trail: auditActions,
          document_type: extractionResults.document_type,
          metadata: {
            page_count: extractionResults.page_count,
            processing_time_ms: extractionResults.processing_time_ms
          }
        })
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `udina_export_${extractionResults.document_type}_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("Failed to export data.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadAudit = () => {
    const jsonStr = exportAuditTrail();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `udina_audit_trail_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  let totalCells = 0;
  let totalConfidence = 0;
  auditedData.audited_tables.forEach((t: any) => {
    totalCells += t.summary.total_cells;
    totalConfidence += (t.summary.average_confidence * t.summary.total_cells);
  });
  const avgConf = totalCells > 0 ? (totalConfidence / totalCells) : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-auto mt-10 p-8 bg-gradient-to-br from-[#0a1a0a] to-[#0f1f0f] rounded-2xl shadow-xl border border-green-500/20 text-white"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-green-500/10 pb-6 gap-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-green-400" />
            Data Ready for Ylookup
          </h2>
          <p className="text-gray-400 mt-2">Pipeline complete. Structured, normalized, and audited.</p>
        </div>

        <div className="flex gap-6 bg-yl-bg/80 p-4 rounded-xl border border-yl-border">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{auditedData.audited_tables.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Tables</div>
          </div>
          <div className="w-px bg-yl-border"></div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{avgConf.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Avg Conf</div>
          </div>
          <div className="w-px bg-yl-border"></div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{auditActions.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Reviews</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* JSON Card */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 flex flex-col items-center text-center transition-colors hover:bg-white/10"
        >
          <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mb-4 text-green-400">
            <FileJson className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-2">JSON Schema</h3>
          <p className="text-sm text-gray-400 mb-6 flex-1">
            Deeply nested, fully structured Ylookup ingestion schema including mappings and cell-level confidence.
          </p>
          <button
            onClick={() => handleExport("json")}
            disabled={isExporting !== null}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isExporting === "json" ? "Generating..." : <><Download className="w-4 h-4" /> Download JSON</>}
          </button>
        </motion.div>

        {/* CSV Card */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 flex flex-col items-center text-center transition-colors hover:bg-white/10"
        >
          <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mb-4 text-green-300">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-2">CSV Spreadsheet</h3>
          <p className="text-sm text-gray-400 mb-6 flex-1">
            Flat table format ideal for Excel or Google Sheets review. Appends the full human audit trail.
          </p>
          <button
            onClick={() => handleExport("csv")}
            disabled={isExporting !== null}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isExporting === "csv" ? "Generating..." : <><Download className="w-4 h-4" /> Download CSV</>}
          </button>
        </motion.div>
      </div>

      <div className="mt-8 pt-6 border-t border-green-500/10 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Immutable audit trail captures {auditActions.length} human decisions.
        </div>
        <button
          onClick={handleDownloadAudit}
          className="text-sm font-medium text-green-400/70 hover:text-green-400 underline decoration-green-500/30 underline-offset-4"
        >
          Download Audit Log Only
        </button>
      </div>
    </motion.div>
  );
}
