"use client";

import { useState } from "react";

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
      <div className="w-full max-w-4xl mx-auto mt-10 p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-medium text-gray-900">No tables found</h3>
        <p className="text-gray-500 mt-2">We couldn't extract any structured tables from this document.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Extraction Results</h2>
          <div className="flex items-center space-x-3 mt-2 text-sm text-gray-500">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {docType}
            </span>
            <span>Pages: {data.page_count}</span>
            <span>Time: {(data.processing_time_ms / 1000).toFixed(2)}s</span>
            <span>Tables: {tables.length}</span>
          </div>
        </div>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("formatted")}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              viewMode === "formatted" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Formatted
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              viewMode === "raw" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Raw JSON
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
        {tables.map((_: any, idx: number) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === idx
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent"
            }`}
          >
            Table {idx + 1}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {viewMode === "raw" ? (
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-[600px] text-sm">
            {JSON.stringify(tables[activeTab], null, 2)}
          </pre>
        ) : (
          <div className="overflow-x-auto border rounded-lg max-h-[600px]">
            {tables[activeTab]?.raw_html ? (
              <div 
                className="p-4 prose max-w-none" 
                dangerouslySetInnerHTML={{ __html: tables[activeTab].raw_html }} 
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
