"use client";

import React, { useEffect, useState, useTransition } from "react";
import { createClientConnection } from "../utils/supabase/client";
import {
  getSubjectsByChild,
  getBooksBySubject,
  adaptMaterialAction,
} from "./actions";
import { Loader2, BookOpen, FileText, CheckCircle2 } from "lucide-react";
import UploadBookModal from "./_components/UploadBookModal";
import MainFormContainer from "./_components/MainFormContainer";
import { ActiveTabType } from "./_components/FormTabs";

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

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const [aiResponse, setAiResponse] = useState<string>("");

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

  return (
    <div className="bg-background font-sans text-foreground flex flex-col justify-between min-h-[calc(100vh-88px)]">
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* ЛІВА ПАНЕЛЬ — СПИСОК УЧНІВ */}
        <div className="lg:col-span-4 flex flex-col gap-4 w-full">
          <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-xs text-left w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-base text-foreground flex items-center gap-2">
                🧠 Налаштування ШІ-адаптації
              </h2>
              <a
                href="/onboarding"
                className="text-[11px] font-black bg-secondary hover:bg-secondary/80 text-foreground px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                + Додати
              </a>
            </div>

            {loadingChildren ? (
              <div className="py-6 text-center text-xs font-bold text-muted-foreground/60 animate-pulse">
                Зчитуємо картки учнів з базы...
              </div>
            ) : children.length > 0 ? (
              <div className="flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto pb-3 lg:pb-0 max-h-none lg:max-w-none lg:max-h-[500px] snap-x snap-mandatory pr-1 scrollbar-thin">
                {children.map((child) => {
                  const isActive = activeChild?.id === child.id;
                  return (
                    <button
                      key={child.id}
                      onClick={() => setActiveChild(child)}
                      className={`snap-center shrink-0 w-[260px] lg:w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-1.5 focus:outline-hidden ${
                        isActive
                          ? "bg-emerald-active/10 border-emerald-active shadow-xs"
                          : "bg-card border-border hover:border-foreground/10"
                      }`}
                    >
                      <p className="text-sm font-black text-foreground flex justify-between items-center gap-2">
                        <span className="truncate">👶 {child.child_name}</span>
                        {isActive && (
                          <span className="text-[9px] bg-emerald-active text-background px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shrink-0">
                            Активний
                          </span>
                        )}
                      </p>

                      <div className="flex gap-3 text-[11px] font-bold text-muted-foreground/70">
                        {child.child_age && (
                          <span>🎂 Вік: {child.child_age} р.</span>
                        )}
                        {child.school_class && (
                          <span>Клас: {child.school_class}</span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-foreground/80 truncate pt-1 border-t border-dashed border-border w-full text-left">
                        🧬 {child.ref_diagnoses?.title || "Діагноз не вказано"}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs font-bold text-muted-foreground/60">
                Немає доданих профілів дітей.
              </div>
            )}
          </div>
        </div>
        {/* ПРАВА ПАНЕЛЬ — ГОЛОВНА РОБОЧА ЗОНА ВВЕДЕННЯ */}
        <div className="lg:col-span-8 flex flex-col gap-5 w-full">
          {activeChild ? (
            <div className="space-y-5 w-full">
              {/* 1. СІТКА ПРЕДМЕТІВ */}
              {subjects.length > 0 && (
                <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-xs text-left w-full space-y-3 animate-in fade-in duration-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    📚 Оберіть предмет для {activeChild.child_name}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.map((subj) => {
                      const isSubjActive = activeSubject?.id === subj.id;
                      return (
                        <button
                          key={subj.id}
                          onClick={() => setActiveSubject(subj)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer focus:outline-hidden active:scale-95 ${
                            isSubjActive
                              ? "bg-amber-100/90 border-amber-400 text-slate-900 font-black shadow-3xs"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {subj.subject_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. СІТКА КНИЖОК */}
              {activeSubject && (
                <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-xs text-left w-full space-y-3 animate-in fade-in duration-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    📖 Підручники з предмету ({activeSubject.subject_name}):
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
                              {book.publishing_year
                                ? `• ${book.publishing_year}`
                                : ""}
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
              )}

              {/* 3. НАША БОЙОВА ФОРМА, ЗВ'ЯЗАНА З REАЛЬНИМ OpenAI ТА SUPABASE */}
              <MainFormContainer
                isGenerating={isGenerating}
                onSubmit={async (formData) => {
                  if (!formData.text.trim()) return;

                  setIsGenerating(true);
                  setAiResponse(""); // Очищуємо старий екран перед новим кліком

                  // Викликаємо тонкий декларативний екшен
                  const res = await adaptMaterialAction({
                    text: formData.text,
                    childId: activeChild.id,
                    userRole: "family", // Тестуємо затишний квест Мами
                    subjectName:
                      activeSubject?.subject_name || "Загальний предмет",
                  });

                  setIsGenerating(false);

                  if (res.success && res.data) {
                    setAiResponse(res.data); // Жива казка летить на екран!
                    console.log(
                      "🚀 Запис в history_adaptations пройшов, ШІ відповів!",
                    );
                  } else {
                    alert(res.error || "Не вдалося отримати адаптацію від ШІ.");
                  }
                }}
              />

              {/* 4. ТИМЧАСОВЕ ВИВЕДЕННЯ РЕЗУЛЬТАТУ ДЛЯ РОЗВІДКИ БОЄМ */}
              {aiResponse && (
                <div className="mt-5 p-6 bg-white border-2 border-slate-200 rounded-3xl shadow-3xs text-left animate-in fade-in duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                    ✨ Жива відповідь OpenAI (Записано в базі та R2):
                  </p>
                  <div className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed font-semibold">
                    {aiResponse}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border-2 border-border p-8 rounded-3xl text-center text-xs font-bold text-muted-foreground/60 shadow-xs flex flex-col items-center justify-center min-h-[280px] animate-in fade-in duration-200">
              <p className="max-w-xs break-words whitespace-normal leading-relaxed">
                👈 Будь ласка, оберіть картку учня або дитини на лівій панелі,
                щоб активувати ШІ-простір адаптації під її індивідуальні освітні
                потреби.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* МОДАЛЬНЕ ВІКНО ДОДАННЯ ПІДРУЧНИКА */}
      <UploadBookModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        subjectName={activeSubject?.subject_name || "Невідомий предмет"}
        schoolClass={activeChild?.school_class || 0}
        subjectId={activeSubject?.id || ""}
        programId={activeChild?.program_id || null}
        onSuccess={(newBook) => {
          setBooks((prev) => [...prev, newBook as BookData]);
          setIsUploadOpen(false);
        }}
      />
    </div>
  );
}
