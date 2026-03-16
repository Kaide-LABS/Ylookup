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
    <div className="w-full max-w-3xl mx-auto mb-10">
      {/* Icon row with lines */}
      <div className="relative flex items-center justify-between h-12">
        {/* Background line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-yl-border-light"></div>

        {/* Active line */}
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-green-500"
          initial={{ width: "0%" }}
          animate={{
            width: currentPhase === "extract" ? "10%" :
                   currentPhase === "normalize" ? "50%" :
                   currentPhase === "audit" ? "90%" : "100%"
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-colors duration-300 bg-yl-card
                  ${status === "complete" ? "border-green-500 text-green-400" :
                    status === "active" ? "border-green-400 text-green-400 ring-4 ring-green-500/20" :
                    "border-yl-border text-gray-600"}
                `}
              >
                {status === "complete" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : status === "active" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Labels row */}
      <div className="flex items-start justify-between mt-3">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          return (
            <div key={step.id} className="text-center w-12">
              <p className={`text-xs font-bold ${status === "active" ? "text-green-400" : status === "complete" ? "text-green-500" : "text-gray-600"}`}>
                Step {index + 1}
              </p>
              <p className={`text-[10px] font-medium mt-0.5 leading-tight ${status === "active" ? "text-green-400/70" : status === "complete" ? "text-gray-400" : "text-gray-600"}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
