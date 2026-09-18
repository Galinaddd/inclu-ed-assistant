"use client";

import React, { useEffect, useState, useTransition } from "react";
import { createClientConnection } from "../utils/supabase/client";
import { getSubjectsByChild, getBooksBySubject } from "./actions";
import { Loader2, BookOpen, FileText, CheckCircle2 } from "lucide-react";
import UploadBookModal from "./_components/UploadBookModal";

interface ChildProfile {
  id: string;
  user_id: string;
  child_name: string;
  child_profile: string;
  support_level: number;
  child_age: number | null;
  school_class: number | null;
  program_id: string | null;
  ref_diagnoses?: {
    title: string;
  };
}

interface SubjectData {
  id: string;
  subject_name: string;
  program_id: string;
  school_class: number;
}

interface BookData {
  id: string;
  title: string;
  publisher: string | null;
  publishing_year: number | null;
}

export default function DashboardPage() {
  const supabase = createClientConnection();

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [activeSubject, setActiveSubject] = useState<SubjectData | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [books, setBooks] = useState<BookData[]>([]);
  const [activeBook, setActiveBook] = useState<BookData | null>(null);
  const [loadingBooks, setLoadingBooks] = useState(false);

  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // 1. Дебаг бази даних у браузері
  useEffect(() => {
    const debugDatabase = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        console.log("=== ЧИСТИЙ ДЕБАГ ДАШБОРДУ В БРАУЗЕРІ ===", profile);
      }
    };
    debugDatabase();
  }, [supabase]);

  // 2. Реляційне завантаження дітей
  useEffect(() => {
    const fetchChildrenData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data, error } = await supabase
          .from("children_profiles")
          .select("*, ref_diagnoses(title)")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (data && !error) {
          const parsedChildren = data as unknown as ChildProfile[];
          setChildren(parsedChildren);

          if (parsedChildren.length === 1) {
            setActiveChild(parsedChildren[0]);
          } else {
            setActiveChild(null);
          }
        }
      } catch (err) {
        console.error("Не вдалося підтягнути профілі учнів:", err);
      } finally {
        setLoadingChildren(false);
      }
    };
    fetchChildrenData();
  }, [supabase]);

  // 3. Динамічний фетч предметів при зміні дитини
  useEffect(() => {
    if (!activeChild?.school_class) {
      setSubjects([]);
      setActiveSubject(null);
      return;
    }

    startTransition(async () => {
      setLoadingSubjects(true);
      setActiveSubject(null);
      setBooks([]);
      setActiveBook(null);

      const res = await getSubjectsByChild(
        activeChild.school_class!,
        activeChild.program_id,
      );
      if (res.success) {
        setSubjects(res.data);
      }
      setLoadingSubjects(false);
    });
  }, [activeChild]);

  // 4. Динамічний фетч книжок при виборі предмета
  useEffect(() => {
    if (!activeSubject || !activeChild?.school_class) {
      setBooks([]);
      setActiveBook(null);
      return;
    }

    startTransition(async () => {
      setLoadingBooks(true);
      setActiveBook(null);

      const res = await getBooksBySubject(
        activeSubject.id,
        activeChild.school_class!,
      );
      if (res.success) {
        setBooks(res.data);
      }
      setLoadingBooks(false);
    });
  }, [activeSubject, activeChild]);

  const handleAdaptationSubmit = () => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      alert("Матеріал успішно адаптовано!");
    }, 2000);
  };
  return (
    <div className="bg-[#FAF9F6] font-sans text-slate-900 flex flex-col justify-between min-h-[calc(100vh-88px)]">
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* ЛІВА ПАНЕЛЬ — СПИСОК УЧНІВ */}
        <div className="lg:col-span-4 flex flex-col gap-4 w-full">
          <div className="bg-white border-2 border-slate-200 p-5 rounded-2xl shadow-xs text-left w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-base text-slate-900 flex items-center gap-2">
                🧠 Налаштування ШІ-адаптації
              </h2>
              <a
                href="/onboarding"
                className="text-[11px] font-black bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                + Додати
              </a>
            </div>

            {loadingChildren ? (
              <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse">
                Зчитуємо картки учнів з бази...
              </div>
            ) : children.length > 0 ? (
              <div className="flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto pb-3 lg:pb-0 max-h-none lg:max-w-none lg:max-h-[500px] snap-x snap-mandatory pr-1 scrollbar-thin">
                {children.map((child) => {
                  const isActive = activeChild?.id === child.id;
                  return (
                    <button
                      key={child.id}
                      onClick={() => setActiveChild(child)}
                      className={`snap-center shrink-0 w-[260px] lg:w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/40 ${
                        isActive
                          ? "bg-emerald-50/40 border-emerald-500 shadow-xs"
                          : "bg-white border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <p className="text-sm font-black text-slate-900 flex justify-between items-center gap-2">
                        <span className="truncate">👶 {child.child_name}</span>
                        {isActive && (
                          <span className="text-[9px] bg-emerald-700 text-white px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shrink-0">
                            Активний
                          </span>
                        )}
                      </p>

                      <div className="flex gap-3 text-[11px] font-bold text-slate-400">
                        {child.child_age && (
                          <span>🎂 Вік: {child.child_age} р.</span>
                        )}
                        {child.school_class && (
                          <span>Клас: {child.school_class}</span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-slate-700 truncate pt-1 border-t border-dashed border-slate-100 w-full text-left">
                        🧬 {child.ref_diagnoses?.title || "Діагноз не вказано"}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs font-bold text-slate-400">
                Немає доданих профілів дітей.
              </div>
            )}
          </div>
        </div>

        {/* ПРАВА ПАНЕЛЬ — ДИНАМІЧНИЙ ВИВІД ПРЕДМЕТІВ ТА ПІДРУЧНИКІВ */}
        <div className="lg:col-span-8 flex flex-col gap-6 w-full text-left">
          {/* СЕКЦІЯ 1: СІТКА НАВЧАЛЬНИХ ПРЕДМЕТІВ */}
          {activeChild && (
            <div className="bg-white border-2 border-slate-200 p-5 rounded-2xl shadow-xs w-full">
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                📂 Предмети програми для {activeChild.child_name} (
                {activeChild.school_class} клас)
              </h3>

              {loadingSubjects ? (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 py-2 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                  <span>Зчитуємо предмети...</span>
                </div>
              ) : subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((subject) => {
                    const isSubActive = activeSubject?.id === subject.id;
                    return (
                      <button
                        key={subject.id}
                        onClick={() => setActiveSubject(subject)}
                        className={`text-xs font-bold px-3 py-2 rounded-xl border-2 transition-all cursor-pointer focus:outline-none ${
                          isSubActive
                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        {subject.subject_name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400 py-2">
                  Предмети програми відсутні в базі.
                </p>
              )}
            </div>
          )}

          {/* СЕКЦІЯ 2: СІТКА ПІДРУЧНИКІВ АВТОРІВ + КНОПКА ДОДАТИ КНИГУ */}
          {activeSubject && (
            <div className="bg-white border-2 border-slate-200 p-5 rounded-2xl shadow-xs w-full animate-in fade-in slide-in-from-top-1 duration-200">
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                📚 Доступні підручники з предмета «{activeSubject.subject_name}»
              </h3>

              {loadingBooks ? (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 py-4 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>Шукаємо підручники авторів...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Перебір існуючих книг з бази даних */}
                  {books.map((book) => {
                    const isBookActive = activeBook?.id === book.id;
                    return (
                      <button
                        key={book.id}
                        onClick={() => setActiveBook(book)}
                        className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 h-auto focus:outline-none ${
                          isBookActive
                            ? "bg-indigo-50/40 border-indigo-500 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <BookOpen
                          className={`h-5 w-5 mt-0.5 shrink-0 ${isBookActive ? "text-indigo-600" : "text-slate-400"}`}
                        />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <p className="text-xs font-black text-slate-900 break-words whitespace-normal leading-tight">
                            {book.title}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 truncate">
                            {book.publisher || "Видавництво"}{" "}
                            {book.publishing_year
                              ? `• ${book.publishing_year} р.`
                              : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {/* ➕ КНОПКА: Додати новий підручник — ВІДКРИВАЄ НАШЕ ВІКНО */}
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="text-left p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 transition-all cursor-pointer flex items-center gap-3 group focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/20 w-full"
                  >
                    <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-indigo-200 transition-colors">
                      <span className="text-slate-400 group-hover:text-indigo-600 font-black text-sm">
                        +
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-black text-slate-700 group-hover:text-indigo-600 transition-colors">
                        Додати новий підручник
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">
                        Завантажити PDF файл
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Якщо нічого не обрано — підказка */}
          {!activeChild && (
            <div className="bg-white border-2 border-dashed border-slate-200 p-8 rounded-2xl text-center text-sm font-bold text-slate-400 shadow-xs">
              👈 Оберіть профіль учня зліва, щоб відобразити предмети
            </div>
          )}
        </div>
      </main>

      {/* НАШЕ МІКРО-МОДАЛЬНЕ ВІКНО ЗАВАНТАЖЕННЯ КНИГ */}
      <UploadBookModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        subjectName={activeSubject?.subject_name || "Предмет"}
        schoolClass={activeChild?.school_class || 1}
      />
    </div>
  );
}
