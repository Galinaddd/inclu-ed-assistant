"use client";

import React, { useEffect } from "react";
import { BookOpen } from "lucide-react";
import { createClientConnection } from "@/app/utils/supabase/client"; // 🟢 Твій оригінальний робочий імпорт, який не викликає помилок
// 🟢 Твій оригінальний робочий імпорт, який не викликає помилок:

interface BookData {
  id: string;
  title: string;
  publisher: string | null;
  publishing_year: number | null;
  book_structure?: any; // Поле для відстеження готовності
}

interface BookSelectorProps {
  subjectName: string;
  books: BookData[];
  activeBook: BookData | null;
  setActiveBook: (book: BookData | null) => void;
  setIsUploadOpen: (open: boolean) => void;
  onBookUpdate?: (updatedBook: BookData) => void; // Колбек для сповіщення батьківського компонента
}

export default function BookSelector({
  subjectName,
  books,
  activeBook,
  setActiveBook,
  setIsUploadOpen,
  onBookUpdate,
}: BookSelectorProps) {
  // Інтегруємо безпечну Realtime-підписку з фіксом типізації `payload`
  useEffect(() => {
    const processingBooks = books.filter((book) => !book.book_structure);
    if (processingBooks.length === 0) return;

    // Створюємо з'єднання через твій хелпер
    const supabase = createClientConnection();

    const channel = supabase
      .channel("dashboard-books-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "books" },
        (payload: any) => {
          // 🟢 Фікс помилки implicit 'any'
          const updatedBook = payload.new as BookData;
          const isTargetBook = processingBooks.some(
            (b) => b.id === updatedBook.id,
          );

          if (isTargetBook && updatedBook.book_structure && onBookUpdate) {
            onBookUpdate(updatedBook);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [books, onBookUpdate]);

  // М'які дитячі градієнти для обкладинок (без різких кольорів)
  const getCoverBg = (title: string) => {
    const colors = [
      "bg-linear-to-br from-amber-400 to-orange-400 text-amber-950",
      "bg-linear-to-br from-emerald-400 to-teal-500 text-emerald-950",
      "bg-linear-to-br from-sky-400 to-blue-500 text-sky-950",
      "bg-linear-to-br from-indigo-400 to-purple-500 text-indigo-950",
    ];
    const index = title.length % colors.length;
    return colors[index];
  };

  return (
    <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-xs text-left w-full space-y-3 animate-in fade-in duration-200">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
        📖 Підручники з предмету ({subjectName}):
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {books.map((book) => {
          const isBookActive = activeBook?.id === book.id;
          const isProcessing = !book.book_structure;

          return (
            <button
              key={book.id}
              onClick={() => !isProcessing && setActiveBook(book)}
              disabled={isProcessing}
              className={`p-3 rounded-2xl border-2 text-left transition-all flex items-center gap-4 focus:outline-hidden ${
                isProcessing
                  ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                  : isBookActive
                    ? "bg-amber-50 border-amber-400 text-slate-900 shadow-3xs font-black cursor-pointer scale-[1.01]"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 cursor-pointer active:scale-98"
              }`}
            >
              {/* Візуальна обкладинка підручника (Титулка) */}
              <div
                className={`w-12 h-16 rounded-xl shrink-0 flex flex-col justify-between p-1.5 shadow-xs border border-black/5 overflow-hidden ${getCoverBg(book.title)}`}
              >
                <div className="text-[8px] font-black uppercase tracking-tighter line-clamp-2 leading-tight">
                  {book.title}
                </div>
                <div className="text-[6px] font-bold text-black/50 text-right uppercase">
                  Книга
                </div>
              </div>

              {/* Інформація */}
              <div className="truncate w-full space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-slate-950 truncate">
                    {book.title}
                  </p>
                  {isProcessing && (
                    <span className="text-[8px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm shrink-0 animate-pulse">
                      ОБРОБКА
                    </span>
                  )}
                </div>
                <p
                  className={`text-[10px] font-bold ${isBookActive ? "text-amber-800/90" : "text-slate-400"}`}
                >
                  {book.publisher || "Глобальний каталог"}
                </p>
                {book.publishing_year && (
                  <p className="text-[9px] font-medium text-slate-400">
                    Рік: {book.publishing_year}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="p-3 min-h-22 rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 hover:bg-white hover:border-slate-300 text-left transition-all cursor-pointer flex items-center gap-4 text-slate-500 font-black text-xs focus:outline-hidden active:scale-98"
        >
          <div className="w-12 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center font-black text-lg text-slate-400 shrink-0">
            +
          </div>
          <span>Додати новий підручник</span>
        </button>
      </div>
    </div>
  );
}
