"use client";

import React from "react";
import { BookOpen } from "lucide-react";

interface BookData {
  id: string;
  title: string;
  publisher: string | null;
  publishing_year: number | null;
}

interface BookSelectorProps {
  subjectName: string;
  books: BookData[];
  activeBook: BookData | null;
  setActiveBook: (book: BookData | null) => void;
  setIsUploadOpen: (open: boolean) => void;
}

export default function BookSelector({
  subjectName,
  books,
  activeBook,
  setActiveBook,
  setIsUploadOpen,
}: BookSelectorProps) {
  return (
    <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-xs text-left w-full space-y-3 animate-in fade-in duration-200">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
        📖 Підручники з предмету ({subjectName}):
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {books.map((book) => {
          const isBookActive = activeBook?.id === book.id;
          return (
            <button
              key={book.id}
              onClick={() => setActiveBook(book)}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 focus:outline-hidden ${
                isBookActive
                  ? "bg-amber-100/90 border-amber-400 text-slate-900 shadow-3xs font-black"
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              <BookOpen
                className={`h-5 w-5 shrink-0 ${isBookActive ? "text-slate-900" : "text-slate-400"}`}
              />
              <div className="truncate">
                <p className="text-xs font-black text-slate-900 truncate">
                  {book.title}
                </p>
                <p
                  className={`text-[10px] font-bold mt-0.5 ${isBookActive ? "text-slate-800" : "text-slate-400"}`}
                >
                  {book.publisher || "Глобальний каталог"}{" "}
                  {book.publishing_year ? `• ${book.publishing_year}` : ""}
                </p>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-white/40 hover:bg-white hover:border-slate-300 text-left transition-all cursor-pointer flex items-center gap-3 text-slate-500 font-black text-xs focus:outline-hidden"
        >
          <span className="h-5 w-5 border-2 border-dashed border-slate-200 rounded-md flex items-center justify-center font-black text-sm text-center shrink-0">
            +
          </span>
          <span>Додати новий підручник</span>
        </button>
      </div>
    </div>
  );
}
