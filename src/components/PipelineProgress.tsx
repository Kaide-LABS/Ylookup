"use client";

import { motion } from "framer-motion";
import { FileText, Map, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

interface PipelineProgressProps {
  currentPhase: "extract" | "normalize" | "audit" | "complete";
}

export default function PipelineProgress({ currentPhase }: PipelineProgressProps) {
  const steps = [
    { id: "extract", label: "Table Extraction", icon: FileText },
    { id: "normalize", label: "GAAP Normalization", icon: Map },
    { id: "audit", label: "Confidence Audit", icon: ShieldAlert },
  ];

  const getStepStatus = (stepId: string) => {
    if (currentPhase === "complete") return "complete";
    if (currentPhase === "audit") {
      if (stepId === "extract" || stepId === "normalize") return "complete";
      if (stepId === "audit") return "active";
    }
    if (currentPhase === "normalize") {
      if (stepId === "extract") return "complete";
      if (stepId === "normalize") return "active";
      return "pending";
    }
    if (currentPhase === "extract") {
      if (stepId === "extract") return "active";
      return "pending";
    }
    return "pending";
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-12">
      <div className="relative flex items-center justify-between">
        
        {/* Connecting Lines Background */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full z-0"></div>
        
        {/* Animated Connecting Line Foreground */}
        <motion.div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 rounded-full z-0"
          initial={{ width: "0%" }}
          animate={{ 
            width: currentPhase === "extract" ? "15%" : 
                   currentPhase === "normalize" ? "50%" : 
                   currentPhase === "audit" ? "85%" : "100%" 
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        ></motion.div>

        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border-2 transition-colors duration-300 bg-white
                  ${status === "complete" ? "border-green-500 text-green-500" : 
                    status === "active" ? "border-indigo-500 text-indigo-600 ring-4 ring-indigo-100" : 
                    "border-gray-200 text-gray-400"}
                `}
              >
                {status === "complete" ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : status === "active" ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }}>
                    <Loader2 className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <Icon className="w-6 h-6" />
                )}
              </motion.div>
              
              <div className="mt-3 text-center">
                <p className={`text-sm font-bold ${status === "active" ? "text-indigo-900" : status === "complete" ? "text-green-700" : "text-gray-400"}`}>
                  Step {index + 1}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${status === "active" ? "text-indigo-600" : status === "complete" ? "text-gray-600" : "text-gray-400"}`}>
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
