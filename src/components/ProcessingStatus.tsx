"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  jobId?: string;
  statusMessage?: string;
  onComplete?: (data: any) => void;
  onError?: (error: string) => void;
}

export default function ProcessingStatus({ jobId, statusMessage, onComplete, onError }: ProcessingStatusProps) {
  const [statusText, setStatusText] = useState(statusMessage || "Extracting tables...");
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  // Store callbacks in refs to avoid re-triggering useEffect
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    startTime.current = Date.now();
    const timer = setInterval(() => {
      setElapsed((Date.now() - startTime.current) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (statusMessage) {
      setStatusText(statusMessage);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (!jobId) return;

    let stopped = false;

    const checkStatus = async () => {
      if (stopped) return;

      try {
        const res = await fetch(`/api/status/${jobId}`);
        if (!res.ok) throw new Error("Failed to check status");

        const data = await res.json();

        if (data.status === "completed") {
          setStatusText("Processing complete");
          stopped = true;
          onCompleteRef.current?.(data);
        } else if (data.status === "failed") {
          stopped = true;
          onErrorRef.current?.(data.error || "Processing failed");
        } else {
          if (!statusMessage) setStatusText("Extracting tables...");
          // Schedule next poll — setTimeout is more reliable than setInterval
          // on throttled/old browsers
          setTimeout(checkStatus, 2000);
        }
      } catch (err: any) {
        // On network error, retry instead of giving up
        if (!stopped) {
          setTimeout(checkStatus, 3000);
        }
      }
    };

    // Start polling
    checkStatus();

    // Also re-check when tab becomes visible (fixes browser throttling)
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !stopped) {
        checkStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [jobId, statusMessage]);

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 text-center p-10 bg-yl-card rounded-xl shadow-sm border border-yl-border">
      <div className="flex justify-center mb-4">
        <Loader2 className="h-10 w-10 text-green-400 animate-spin" />
      </div>
      <h3 className="text-lg font-medium text-white">{statusText}</h3>
      <p className="text-sm text-gray-500 mt-2">
        Elapsed: {elapsed.toFixed(1)}s
      </p>
    </div>
  );
}
