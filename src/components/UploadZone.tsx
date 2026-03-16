"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileType } from "lucide-react";

interface UploadZoneProps {
  onUploadStart: (jobId: string) => void;
  onError: (error: string) => void;
}

export default function UploadZone({ onUploadStart, onError }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        onError("Please upload a PDF file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/extract-tables", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload file");
      }
      
      const data = await response.json();
      if (data.job_id) {
        onUploadStart(data.job_id);
      } else {
        throw new Error("No job ID received");
      }
    } catch (err: any) {
      onError(err.message || "An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      <motion.div
        animate={{ scale: isDragging ? 1.02 : 1 }}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Drag and drop your PDF here</h3>
        <p className="text-sm text-gray-500 mb-6">or click to select a file (Max 50MB)</p>
        
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          id="file-upload"
          onChange={handleFileChange}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Select File
        </label>

        {file && (
          <div className="mt-6 flex items-center justify-center space-x-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
            <FileType className="h-5 w-5 text-blue-500" />
            <span className="font-medium truncate max-w-[200px]">{file.name}</span>
            <span className="text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
          </div>
        )}

        {file && (
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={`mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isUploading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isUploading ? "Uploading..." : "Extract Tables"}
          </button>
        )}
      </motion.div>
    </div>
  );
}
