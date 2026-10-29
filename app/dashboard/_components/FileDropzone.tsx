"use client";

import React from "react";
import { UploadCloud } from "lucide-react";

interface FileDropzoneProps {
  fileInputId: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  dragActive: boolean;
  isProcessing: boolean;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  fileInputId,
  fileInputRef,
  file,
  dragActive,
  isProcessing,
  handleDrag,
  handleDrop,
  handleFileChange,
}) => {
  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all relative ${
        dragActive
          ? "border-sky-500 bg-sky-50/30 scale-[1.01]"
          : file
            ? "border-emerald-500 bg-emerald-50/10"
            : "border-slate-300 bg-slate-50/50"
      }`}
    >
      <input
        type="file"
        id={fileInputId}
        ref={fileInputRef}
        accept=".pdf"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        disabled={isProcessing}
      />
      {!file ? (
        <div className="space-y-3 pointer-events-none">
          <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mx-auto shadow-xs">
            <UploadCloud className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700">
              Перетягніть PDF-підручник сюди або{" "}
              <span className="text-sky-700 underline">
                оберіть на комп'ютері
              </span>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pointer-events-none animate-in fade-in zoom-in-95">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
            <span className="text-emerald-600 text-xs font-black">PDF</span>
          </div>
          <div className="max-w-xs mx-auto">
            <p className="text-xs font-black text-slate-900 truncate">
              {file.name}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              {(file.size / (1024 * 1024)).toFixed(2)} МБ
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
