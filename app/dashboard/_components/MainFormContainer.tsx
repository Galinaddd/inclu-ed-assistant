"use client";

import React, { useState } from "react";
import FormTabs, { ActiveTabType } from "./FormTabs";
import FormContent from "./FormContent";
import { Sparkles } from "lucide-react";

interface MainFormContainerProps {
  onSubmit: (data: {
    tab: ActiveTabType;
    text: string;
    file: File | null;
  }) => void;
  isGenerating?: boolean;
}

export default function MainFormContainer({
  onSubmit,
  isGenerating = false,
}: MainFormContainerProps) {
  const [activeTab, setActiveTab] = useState<ActiveTabType>("text");
  const [inputText, setInputText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "text" && !inputText.trim()) return;
    if (activeTab === "attachment" && !file) return;
    onSubmit({ tab: activeTab, text: inputText, file });
  };

  const isDisabled =
    isGenerating ||
    (activeTab === "text" && !inputText.trim()) ||
    (activeTab === "attachment" && !file);

  return (
    <form
      className="bg-white border-2 border-slate-200 p-6 rounded-3xl shadow-xs text-left w-full flex flex-col gap-6 h-auto"
      onSubmit={handleSubmit}
    >
      <FormTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      <FormContent
        activeTab={activeTab}
        inputText={inputText}
        setInputText={setInputText}
        file={file}
        setFile={setFile}
      />
      <div className="pt-1 shrink-0">
        <button
          type="submit"
          disabled={isDisabled}
          className={`w-full py-3.5 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 active:scale-[0.99] ${
            isDisabled
              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              : "bg-emerald-700 hover:bg-emerald-800 shadow-sm" // 🔥 Ваш шляхетний інклюзивний смарагдовий з лого
          }`}
        >
          <Sparkles className="h-4 w-4 text-white/80" />
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
