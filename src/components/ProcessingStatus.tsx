"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  jobId: string;
  onComplete: (data: any) => void;
  onError: (error: string) => void;
}

export default function ProcessingStatus({ jobId, onComplete, onError }: ProcessingStatusProps) {
  const [statusText, setStatusText] = useState("Extracting tables...");

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await fetch(`http://localhost:8000/status/${jobId}`);
        if (!res.ok) throw new Error("Failed to check status");
        
        const data = await res.json();
        
        if (data.status === "completed") {
          setStatusText("Processing complete");
          clearInterval(intervalId);
          onComplete(data);
        } else if (data.status === "failed") {
          clearInterval(intervalId);
          onError(data.error || "Processing failed");
        } else {
          // still processing
          setStatusText("Extracting tables...");
        }
      } catch (err: any) {
        clearInterval(intervalId);
        onError(err.message || "Error checking status");
      }
    };

    intervalId = setInterval(checkStatus, 2000);
    checkStatus(); // Initial check

    return () => clearInterval(intervalId);
  }, [jobId, onComplete, onError]);

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="inline-block"
      >
        <Loader2 className="h-10 w-10 text-blue-500 mb-4 mx-auto" />
      </motion.div>
      <h3 className="text-lg font-medium text-gray-900">{statusText}</h3>
      <p className="text-sm text-gray-500 mt-2">This may take a moment depending on the document size.</p>
    </div>
  );
}
