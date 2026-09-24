"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface ParagraphData {
  id: string;
  chapter_title: string;
  paragraph_number: string;
  raw_text: string;
}

interface ParagraphSelectorProps {
  paragraphs: ParagraphData[];
  activeParagraph: ParagraphData | null;
  setActiveParagraph: (p: ParagraphData | null) => void;
  loadingParagraphs: boolean;
}

export default function ParagraphSelector({
  paragraphs,
  activeParagraph,
  setActiveParagraph,
  loadingParagraphs,
}: ParagraphSelectorProps) {
  return (
    <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-xs text-left w-full space-y-3 animate-in fade-in duration-200">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
        📌 Оберіть параграф або тему з підручника:
      </p>

      {loadingParagraphs ? (
        <div className="py-4 text-xs font-bold text-muted-foreground/60 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          Зчитуємо структуру параграфів першоджерела...
        </div>
      ) : paragraphs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {paragraphs.map((p) => {
            const isParagraphActive = activeParagraph?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActiveParagraph(p)}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between focus:outline-hidden active:scale-98 ${
                  isParagraphActive
                    ? "bg-sky-100/70 border-sky-700 text-sky-950 font-black shadow-3xs"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <p className="text-[10px] font-black uppercase text-slate-400">
                  Параграф {p.paragraph_number}
                </p>
                <p className="text-xs font-bold truncate w-full mt-1">
                  {p.chapter_title}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-xs font-bold text-muted-foreground/50 py-2">
          Структура параграфів для цього підручника порожня.
        </div>
      )}
    </div>
  );
}
