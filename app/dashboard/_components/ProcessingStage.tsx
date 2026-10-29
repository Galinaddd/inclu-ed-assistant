"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface ProcessingStageProps {
  isProcessing: boolean;
  loadingStage: string;
  secondsElapsed: number;
}

export const ProcessingStage: React.FC<ProcessingStageProps> = ({
  isProcessing,
  loadingStage,
  secondsElapsed,
}) => {
  if (!isProcessing || !loadingStage) return null;

  return (
    <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-2 animate-in fade-in duration-200 text-sky-900 text-xs font-bold flex items-center gap-2.5">
      <Loader2 className="h-4 w-4 animate-spin text-sky-600 shrink-0" />
      <div className="flex flex-col text-left">
        <span className="break-words whitespace-normal">{loadingStage}</span>
        {secondsElapsed > 0 && (
          <span className="text-[10px] text-sky-600 font-medium mt-0.5">
            ⏱️ Поточний час аналізу: {secondsElapsed}с
          </span>
        )}
      </div>
    </div>
  );
};
