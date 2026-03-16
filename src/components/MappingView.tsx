"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import DOMPurify from "isomorphic-dompurify";

interface Mapping {
  original_term: string;
  canonical_term: string;
  category: string;
  confidence: number;
  rationale: string;
}

interface NormalizedTable {
  page: number;
  table_index: number;
  mappings: Mapping[];
  raw_html: string;
  normalized_html: string;
}

interface MappingViewProps {
  normalizedTables: NormalizedTable[];
  onOverride?: (tableIndex: number, originalTerm: string, newCanonical: string) => void;
}

export default function MappingView({ normalizedTables, onOverride }: MappingViewProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState<"normalized" | "original">("normalized");

  if (!normalizedTables || normalizedTables.length === 0) {
    return null;
  }

  const activeTable = normalizedTables[activeTab];

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (confidence >= 0.7) return <AlertCircle className="w-4 h-4 text-amber-400" />;
    return <XCircle className="w-4 h-4 text-red-400" />;
  };

  const getCategoryColor = (category: string) => {
    if (category === "Income Statement") return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    if (category === "Balance Sheet") return "bg-green-500/10 text-green-400 border border-green-500/20";
    if (category === "Cash Flow") return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
    return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-10 p-6 bg-yl-card rounded-xl shadow-sm border border-yl-border">
      <div className="flex justify-between items-center mb-6 border-b border-yl-border pb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Semantic Mapping</h2>
          <p className="text-sm text-gray-400 mt-1">Normalized to GAAP taxonomy</p>
        </div>
      </div>

      {/* Table Tabs */}
      <div className="flex border-b border-yl-border mb-6 overflow-x-auto">
        {normalizedTables.map((_: any, idx: number) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === idx
                ? "border-b-2 border-green-400 text-green-400"
                : "text-gray-500 hover:text-gray-300 hover:border-gray-600 border-b-2 border-transparent"
            }`}
          >
            Table {idx + 1}
          </button>
        ))}
      </div>

      {/* Mappings List */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Identified Fields ({activeTable?.mappings.length || 0})</h3>

        {activeTable?.mappings.length === 0 ? (
          <div className="text-sm text-gray-500 italic p-4 bg-yl-bg rounded-lg border border-yl-border">
            No fields mapped for this table.
          </div>
        ) : (
          <div className="space-y-3">
            {activeTable?.mappings.map((mapping, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-yl-bg border border-yl-border rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-500 line-through decoration-gray-600">
                      {mapping.original_term}
                    </span>
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    >
                      <ArrowRight className="w-4 h-4 text-green-400/60" />
                    </motion.div>
                    <span className="text-sm font-bold text-white">
                      {mapping.canonical_term}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCategoryColor(mapping.category)}`}>
                      {mapping.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-500">
                      {(mapping.confidence * 100).toFixed(0)}%
                    </span>
                    {getConfidenceIcon(mapping.confidence)}
                    {mapping.confidence < 0.7 && onOverride && (
                      <button
                        onClick={() => {
                          const newTerm = prompt("Override canonical term for: " + mapping.original_term, mapping.canonical_term);
                          if (newTerm && newTerm !== mapping.canonical_term) {
                            onOverride(activeTab, mapping.original_term, newTerm);
                          }
                        }}
                        className="ml-2 text-xs font-semibold text-green-400 hover:text-green-300 underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 italic ml-1">
                  {mapping.rationale}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* HTML View Toggle */}
      <div className="border-t border-yl-border pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-gray-300">Visual Output</h3>
          <div className="flex space-x-2 bg-yl-bg p-1 rounded-lg border border-yl-border">
            <button
              onClick={() => setViewMode("original")}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                viewMode === "original" ? "bg-yl-border-light shadow-sm text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setViewMode("normalized")}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                viewMode === "normalized" ? "bg-yl-border-light shadow-sm text-green-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Normalized
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-yl-border rounded-lg max-h-[600px] bg-yl-bg">
          <div
            className="p-4 prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(viewMode === "original" ? activeTable?.raw_html || "" : activeTable?.normalized_html || "")
            }}
          />
        </div>
      </div>
    </div>
  );
}
