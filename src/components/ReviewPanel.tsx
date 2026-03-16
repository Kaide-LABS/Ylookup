"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Check, XCircle, Edit2, AlertTriangle, AlertCircle } from "lucide-react";
import { CellScore, ReviewAction } from "@/lib/audit-trail";

interface ReviewPanelProps {
  cellScore: CellScore;
  tableIndex: number;
  pageNumber: number;
  onAction: (action: ReviewAction) => void;
  onClose: () => void;
}

export default function ReviewPanel({ cellScore, tableIndex, pageNumber, onAction, onClose }: ReviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newValue, setNewValue] = useState(cellScore.cell_text);
  const [note, setNote] = useState("");

  const getFlagIcon = () => {
    switch (cellScore.flag) {
      case "anomaly": return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "low_confidence": return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const createAction = (type: "accept" | "reject" | "edit"): ReviewAction => {
    return {
      id: crypto.randomUUID(),
      type,
      cell: cellScore,
      new_value: type === "edit" ? newValue : undefined,
      reviewer_note: note || undefined,
      timestamp: new Date().toISOString(),
      table_index: tableIndex,
      page: pageNumber,
    };
  };

  const handleAccept = () => onAction(createAction("accept"));
  const handleReject = () => onAction(createAction("reject"));
  const handleEdit = () => {
    if (newValue.trim() !== cellScore.cell_text) {
      onAction(createAction("edit"));
    }
  };

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          {getFlagIcon()}
          Review Required
        </h3>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="space-y-6">
          
          {/* Extracted Value */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Extracted Value</label>
            {isEditing ? (
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-lg font-medium p-2 border bg-white text-black"
                  autoFocus
                />
                <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-xl font-bold text-gray-900 line-clamp-2">{cellScore.cell_text}</span>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* AI Assessment */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-amber-900 mb-2 flex justify-between">
              AI Assessment
              <span className={`px-2 py-0.5 rounded text-xs text-white ${cellScore.confidence < 80 ? "bg-red-500" : "bg-amber-500"}`}>
                {cellScore.confidence.toFixed(1)}% Conf.
              </span>
            </h4>
            <p className="text-sm text-amber-800 italic">{cellScore.reason}</p>
          </div>

          {/* Location Context */}
          <div className="text-xs text-gray-500 font-medium">
            Location: Table {tableIndex + 1} &bull; Row {cellScore.row_index + 1} &bull; Col {cellScore.col_index + 1}
          </div>

          {/* Reviewer Note */}
          <div>
             <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Reviewer Note (Optional)</label>
             <textarea 
               className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border bg-white text-black"
               rows={2}
               placeholder="Why did you accept/reject this?"
               value={note}
               onChange={(e) => setNote(e.target.value)}
             />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
        {isEditing ? (
          <button
            onClick={handleEdit}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex justify-center items-center gap-2 shadow-sm transition-colors"
          >
            <Check className="w-4 h-4" />
            Save Correction
          </button>
        ) : (
          <>
            <button
              onClick={handleReject}
              className="flex-1 bg-white border border-gray-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-gray-700 font-medium py-2.5 rounded-lg flex justify-center items-center gap-2 shadow-sm transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg flex justify-center items-center gap-2 shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              Accept
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
