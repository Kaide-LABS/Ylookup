"use client";

import { useState, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";

interface ExtractionResultsProps {
  data: any;
}

export default function ExtractionResults({ data }: ExtractionResultsProps) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [activeTab, setActiveTab] = useState(0);

  const tables = data.tables || [];
  const docType = data.document_type || "Unknown Document";

  if (!tables || tables.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-10 p-8 text-center bg-yl-card rounded-xl shadow-sm border border-yl-border">
        <h3 className="text-lg font-medium text-white">No tables found</h3>
        <p className="text-gray-400 mt-2">We couldn't extract any structured tables from this document.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto mt-10 p-6 bg-yl-card rounded-xl shadow-sm border border-yl-border">
      <div className="flex justify-between items-center mb-6 border-b border-yl-border pb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Extraction Results</h2>
          <div className="flex items-center space-x-3 mt-2 text-sm text-gray-400">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
              {docType}
            </span>
            <span>Pages: {data.page_count}</span>
            <span>Time: {(data.processing_time_ms / 1000).toFixed(2)}s</span>
            <span>Tables: {tables.length}</span>
          </div>
        </div>
        <div className="flex space-x-2 bg-yl-bg p-1 rounded-lg border border-yl-border">
          <button
            onClick={() => setViewMode("formatted")}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              viewMode === "formatted" ? "bg-yl-border-light shadow-sm text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Formatted
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              viewMode === "raw" ? "bg-yl-border-light shadow-sm text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Raw JSON
          </button>
        </div>
      </div>

      <div className="flex border-b border-yl-border mb-4 overflow-x-auto">
        {tables.map((_: any, idx: number) => (
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

      <div className="mt-4">
        {viewMode === "raw" ? (
          <pre className="bg-yl-bg text-green-300 p-4 rounded-lg overflow-auto max-h-[600px] text-sm border border-yl-border">
            {JSON.stringify(tables[activeTab], null, 2)}
          </pre>
        ) : (
          <div className="overflow-x-auto border border-yl-border rounded-lg max-h-[600px] bg-yl-bg">
            {tables[activeTab]?.raw_html ? (
              <div
                className="p-4 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(tables[activeTab].raw_html) }}
              />
            ) : (
              <div className="p-8 text-center text-gray-500">
                HTML representation not available. Please check the Raw JSON view.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
