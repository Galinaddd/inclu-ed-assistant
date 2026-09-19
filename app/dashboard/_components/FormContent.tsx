"use client";

import React, { useState } from "react";
import { UploadCloud, HelpCircle } from "lucide-react";
import { ActiveTabType } from "./FormTabs";

interface FormContentProps {
  activeTab: ActiveTabType;
  inputText: string;
  setInputText: (text: string) => void;
  file: File | null;
  setFile: (file: File | null) => void;
}

export default function FormContent({
  activeTab,
  inputText,
  setInputText,
  file,
  setFile,
}: FormContentProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("image/")) {
        setFile(droppedFile);
      } else {
        alert("Будь ласка, завантажте зображення (PNG або JPG).");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full min-h-[180px] flex flex-col">
      {/* 1. ВКЛАДКА: ТЕКСТ ПАРАГРАФА */}
      {activeTab === "text" && (
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Вставте сюди скопійований текст параграфа підручника НУШ..."
          className="w-full flex-1 p-5 rounded-2xl border-2 border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 resize-none min-h-[160px] transition-colors hover:border-slate-300 focus:outline-hidden"
        />
      )}

      {/* 2. ВКЛАДКА: ФОТО АБО ДОКУМЕНТ */}
      {activeTab === "attachment" && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all relative flex-1 min-h-[160px] ${
            dragActive
              ? "border-sky-700 bg-sky-50 scale-[1.01]"
              : file
                ? "border-emerald-700 bg-emerald-50/10"
                : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          {!file ? (
            <div className="space-y-2 pointer-events-none flex flex-col items-center">
              <UploadCloud className="h-6 w-6 text-slate-400" />
              <p className="text-xs font-black text-slate-700">
                Перетягніть фото схеми сюди або{" "}
                <span className="text-sky-700 underline">оберіть файл</span>
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                PNG, JPG
              </p>
            </div>
          ) : (
            <div className="space-y-2 pointer-events-none flex flex-col items-center">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="h-14 w-14 object-cover rounded-xl border border-slate-200"
              />
              <p className="text-xs font-black text-slate-900 truncate max-w-xs">
                {file.name}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. ВКЛАДКА: ПИТАННЯ / ПРОБЛЕМА */}
      {activeTab === "problem" && (
        <div className="space-y-4 w-full flex-1 animate-in fade-in duration-200">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Опишіть ситуацію (наприклад: 'Дитина плутає цифри 3 і 8, як пояснити граючи?')...."
            className="w-full p-5 rounded-2xl border-2 border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 resize-none min-h-[120px] transition-colors hover:border-slate-300 focus:outline-hidden"
          />

          <div className="p-4 bg-sky-50/60 border border-sky-200/80 rounded-2xl flex items-start gap-3 text-[11px] font-bold text-sky-950 leading-relaxed shadow-3xs">
            <HelpCircle className="h-4 w-4 shrink-0 text-sky-700 mt-0.5" />
            <span className="break-words whitespace-normal text-left">
              ШІ не просто перепише текст, а створить індивідуальну підказку,
              перелік ігрового реквізиту (LEGO, картки) та слова щирої
              психологічної підтримки для мами.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
