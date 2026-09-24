"use client";

import React, { useState, useEffect } from "react";
import FormTabs, { ActiveTabType } from "./FormTabs";
import FormContent from "./FormContent";
import { Sparkles, Loader2 } from "lucide-react";

interface MainFormContainerProps {
  inputText: string;
  setInputText: (text: string) => void;
  loadingTextFromR2: boolean;
  isGenerating: boolean;
  onSubmit: (data: {
    tab: ActiveTabType;
    text: string;
    file: File | null;
  }) => void;
  aiResponse: string;
  errorMessage: string | null;
}

export default function MainFormContainer({
  inputText,
  setInputText,
  loadingTextFromR2,
  isGenerating,
  onSubmit,
  aiResponse,
  errorMessage,
}: MainFormContainerProps) {
  const [activeTab, setActiveTab] = useState<ActiveTabType>("text");
  const [file, setFile] = useState<File | null>(null);

  // Перемикаємо вкладку на текст, якщо з R2 прилетів оцифрований параграф
  useEffect(() => {
    if (inputText) setActiveTab("text");
  }, [inputText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "text" && !inputText.trim()) return;
    if (activeTab === "attachment" && !file) return;
    onSubmit({ tab: activeTab, text: inputText, file });
  };

  const isDisabled =
    isGenerating ||
    loadingTextFromR2 ||
    (activeTab === "text" && !inputText.trim()) ||
    (activeTab === "attachment" && !file);

  return (
    <form
      className="bg-white border-2 border-slate-200 p-6 rounded-3xl shadow-xs text-left w-full flex flex-col gap-6 h-auto"
      onSubmit={handleSubmit}
    >
      <FormTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {loadingTextFromR2 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs font-bold text-muted-foreground/70 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin text-sky-700" />
          <span>Завантажуємо оригінальний текст підручника з R2...</span>
        </div>
      ) : (
        <FormContent
          activeTab={activeTab}
          inputText={inputText}
          setInputText={setInputText}
          file={file}
          setFile={setFile}
        />
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border-2 border-red-200 text-red-800 text-xs font-bold rounded-xl text-left">
          ⚠️ {errorMessage}
        </div>
      )}

      {aiResponse && (
        <div className="p-5 bg-emerald-50/50 border-2 border-emerald-500/3xl rounded-2xl text-left space-y-2 animate-in fade-in duration-300">
          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
            ✨ Адаптований інклюзивний матеріал від ШІ:
          </p>
          <div className="text-sm font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
            {aiResponse}
          </div>
        </div>
      )}

      <div className="pt-1 shrink-0">
        <button
          type="submit"
          disabled={isDisabled}
          className={`w-full py-3.5 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 active:scale-[0.99] ${
            isDisabled
              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              : "bg-emerald-700 hover:bg-emerald-800 shadow-sm"
          }`}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/80" />
          ) : (
            <Sparkles className="h-4 w-4 text-white/80" />
          )}
          <span>
            {isGenerating
              ? "ШІ адаптує матеріал..."
              : "Адаптувати під потреби дитини"}
          </span>
        </button>
      </div>
    </form>
  );
}
