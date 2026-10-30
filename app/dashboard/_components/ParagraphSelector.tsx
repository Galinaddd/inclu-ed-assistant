"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";

interface ParagraphData {
  id: string;
  title: string;
  r2_path: string;
  raw_text: string;
}

interface ChapterData {
  id: string;
  title: string; // Назва глави (наприклад, "Вивчаємо літеру: Гг")
  paragraphs: ParagraphData[];
}

interface ParagraphSelectorProps {
  bookStructure: any; // Твій чистий виправлений JSON
  activeParagraph: any | null;
  setActiveParagraph: (p: any | null) => void;
  loadingParagraphs: boolean;
}

export default function ParagraphSelector({
  bookStructure,
  activeParagraph,
  setActiveParagraph,
  loadingParagraphs,
}: ParagraphSelectorProps) {
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  const toggleChapter = (chapterTitle: string) => {
    setOpenChapters((prev) => ({
      ...prev,
      [chapterTitle]: !prev[chapterTitle],
    }));
  };

  // Перевіряємо та приводимо структуру до робочого масиву глав
  const chaptersList: ChapterData[] = Array.isArray(bookStructure)
    ? bookStructure
    : [];

  if (loadingParagraphs) {
    return (
      <div className="bg-card border-2 border-border p-5 rounded-3xl text-center text-xs font-bold text-muted-foreground/60 animate-pulse">
        Синхронізуємо зміст підручника...
      </div>
    );
  }

  if (chaptersList.length === 0) {
    return (
      <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-xs text-left w-full text-xs font-bold text-amber-600/80 bg-amber-50/40 border-dashed border-amber-200 animate-pulse">
        Структура підручника порожня або ще генерується фоновим потоком...
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 animate-in fade-in duration-200">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">
        📌 Зміст підручника (Оберіть тему або параграф):
      </p>

      {chaptersList.map((chapter, chIndex) => {
        const chapterTitle =
          chapter.title || `Розділ підручника №${chIndex + 1}`;
        const isOpen = !!openChapters[chapterTitle];
        const paragraphs = Array.isArray(chapter.paragraphs)
          ? chapter.paragraphs
          : [];

        return (
          <div
            key={chapter.id || `ch-${chIndex}`}
            className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition-all"
          >
            {/* Головний рядок глави (Тригер акордеона) */}
            <button
              type="button"
              onClick={() => toggleChapter(chapterTitle)}
              className="w-full p-4 flex items-center justify-between font-black text-xs text-slate-800 hover:bg-slate-50/80 text-left transition-colors cursor-pointer focus:outline-hidden"
            >
              <span className="truncate pr-4 flex items-center gap-2">
                📖 {chapterTitle}
              </span>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
              )}
            </button>

            {/* Випадаючий список параграфів / сторінок */}
            {isOpen && (
              <div className="p-3 bg-slate-50/50 border-t-2 border-dashed border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
                {paragraphs.map((p, pIndex) => {
                  const isParagraphActive =
                    activeParagraph?.r2_path === p.r2_path;

                  // Створюємо чистий маркер для дитини з R2 імені файлу або локального лічильника
                  const fileMatch = p.r2_path?.match(/paragraph_(\d+)\./);
                  const pageMark = fileMatch
                    ? parseInt(fileMatch[1], 10)
                    : pIndex + 1;

                  return (
                    <button
                      key={p.id || `p-${chIndex}-${pIndex}`}
                      onClick={() =>
                        setActiveParagraph({ ...p, raw_text: p.r2_path })
                      }
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 focus:outline-hidden active:scale-98 ${
                        isParagraphActive
                          ? "bg-sky-100/70 border-sky-700 text-sky-950 font-black shadow-3xs scale-[1.01]"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isParagraphActive
                            ? "bg-sky-700 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {pageMark}
                      </div>
                      <div className="truncate">
                        <span className="text-[9px] block font-black text-slate-400 uppercase tracking-tight">
                          Параграф / Тема
                        </span>
                        <span className="text-xs font-bold block truncate text-slate-900 mt-0.5">
                          {p.title || "Читати далі"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
