"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  jobId?: string;
  statusMessage?: string;
  onComplete?: (data: any) => void;
  onError?: (error: string) => void;
}

export default function ProcessingStatus({ jobId, statusMessage, onComplete, onError }: ProcessingStatusProps) {
  const [statusText, setStatusText] = useState(statusMessage || "Extracting tables...");

  useEffect(() => {
    if (statusMessage) {
      setStatusText(statusMessage);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (!jobId) return;

    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`);
        if (!res.ok) throw new Error("Failed to check status");

        const data = await res.json();

        if (data.status === "completed") {
          setStatusText("Processing complete");
          clearInterval(intervalId);
          if (onComplete) onComplete(data);
        } else if (data.status === "failed") {
          clearInterval(intervalId);
          if (onError) onError(data.error || "Processing failed");
        } else {
          if (!statusMessage) setStatusText("Extracting tables...");
        }
      } catch (err: any) {
        clearInterval(intervalId);
        if (onError) onError(err.message || "Error checking status");
      }
    };

    intervalId = setInterval(checkStatus, 2000);
    checkStatus();

    return () => clearInterval(intervalId);
  }, [jobId, onComplete, onError, statusMessage]);

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 text-center p-10 bg-yl-card rounded-xl shadow-sm border border-yl-border">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="inline-block"
      >
        <Loader2 className="h-10 w-10 text-green-400 mb-4 mx-auto" />
      </motion.div>
      <h3 className="text-lg font-medium text-white">{statusText}</h3>
      <p className="text-sm text-gray-500 mt-2">This may take a moment depending on the document size.</p>
    </div>
  );
}
