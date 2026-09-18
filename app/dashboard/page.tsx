"use client";

import React, { useEffect, useState, useTransition } from "react";
import { createClientConnection } from "../utils/supabase/client";
import { getSubjectsByChild, getBooksBySubject } from "./actions";
import { Loader2, BookOpen, FileText, CheckCircle2 } from "lucide-react";

interface ChildProfile {
  id: string;
  user_id: string;
  child_name: string;
  child_profile: string;
  support_level: number;
  child_age: number | null;
  school_class: number | null;
  program_id: string | null; // <-- ОСЬ ЦЕЙ РЯДОК ВИПРАВИТЬ ПОМИЛКУ НА СТРІЧЦІ 125
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
  // 1. Твій автентичний дебаг
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

        console.log("=== ЧИСТИЙ ДЕБАГ ДАШБОРДУ В БРАУЗЕРІ ===");
        console.log("Мій рядок в таблиці profiles:", profile);
      }
    };
    debugDatabase();
  }, [supabase]);

  // 2. Реляційне завантаження дітей з урахуванням твого розумного UX-правила
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

          // Якщо дитина всього одна — вибираємо її автоматично
          if (parsedChildren.length === 1) {
            setActiveChild(parsedChildren[0]);
          } else {
            setActiveChild(null);
          }
        }
        if (error) console.error("Помилка завантаження дітей:", error.message);
      } catch (err) {
        console.error("Не вдалося підтягнути профілі учнів:", err);
      } finally {
        setLoadingChildren(false);
      }
    };
    fetchChildrenData();
  }, [supabase]);

  // 3. Динамічний фетч ПРЕДМЕТІВ при зміні активної дитини (Правило №5: No Hardcode)
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
      console.log("TTTTTTTTTTTTTT");
      console.log(activeChild.program_id);
      console.log(activeChild.school_class);
      console.log(res);
      if (res.success) {
        setSubjects(res.data);
      }
      setLoadingSubjects(false);
    });
  }, [activeChild]);

  // 4. Динамічний фетч КНИЖОК при виборі предмета
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
        {/* ЛІВА ПАНЕЛЬ — АДАПТИВНИЙ СПИСОК УЧНІВ (Mobile-first) */}
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

                      <p className="text-xs font-bold text-slate-700 truncate pt-1 border-t border-dashed border-slate-100 w-full">
                        🧬 {child.ref_diagnoses?.title || child.child_profile}
                      </p>

                      <div className="text-[9px] font-black uppercase tracking-wider text-sky-800 bg-sky-50 border border-sky-100 rounded-md px-2 py-0.5 w-fit mt-1 shrink-0">
                        🎯 {child.support_level} рівень підтримки
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-center">
                <p className="text-xs font-bold text-amber-900 mb-2">
                  У учня ще немає налаштованого профілю.
                </p>
                <a
                  href="/onboarding"
                  className="inline-flex text-xs font-black text-white bg-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-700"
                >
                  Заповнити анкету
                </a>
              </div>
            )}
          </div>
        </div>
        {/* ПРАВА ПАНЕЛЬ — КАСКАДНИЙ ВИБІР (Предмети ➔ Підручники) */}
        <div className="lg:col-span-8 bg-white border-2 border-slate-200 p-5 md:p-6 rounded-2xl shadow-xs flex flex-col gap-5 text-left w-full h-fit">
          {!activeChild ? (
            <div className="text-center py-12 text-slate-400 font-medium text-sm border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              👈 Будь ласка, оберіть дитину зі списку зліва для початку роботи
            </div>
          ) : (
            <div className="space-y-6 w-full">
              <div>
                <h2 className="font-black text-lg md:text-xl text-slate-900 tracking-tight flex items-center gap-1.5 flex-wrap">
                  Введіть матеріал підручника НУШ для{" "}
                  <span className="text-emerald-700 font-black">
                    «{activeChild.child_name}»
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Матеріал буде адаптовано під {activeChild.support_level}-й
                  рівень підтримки МОН.
                </p>
              </div>

              {/* КРОК 1: Список предметів */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  📚 Крок 1: Оберіть предмет
                </h3>
                {loadingSubjects ? (
                  <div className="text-xs text-slate-400 animate-pulse py-2 font-bold">
                    Шукаємо предмети...
                  </div>
                ) : subjects.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {subjects.map((sub) => {
                      const isSubActive = activeSubject?.id === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setActiveSubject(sub)}
                          className={`p-3 text-xs font-black text-left rounded-xl border-2 transition-all cursor-pointer ${
                            isSubActive
                              ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                              : "bg-white border-slate-100 hover:border-slate-300"
                          }`}
                        >
                          {sub.subject_name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-amber-700 bg-amber-50/70 p-3 border-2 border-dashed border-amber-200 rounded-xl font-bold">
                    📭 Для цього класу ще не додано предметів програми.
                  </div>
                )}
              </div>

              {/* КРОК 2: Список книг */}
              {activeSubject && (
                <div className="space-y-2 pt-2 border-t border-dashed border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    📖 Крок 2: Оберіть підручник
                  </h3>
                  {loadingBooks ? (
                    <div className="text-xs text-slate-400 animate-pulse py-2 font-bold">
                      Зчитуємо книги...
                    </div>
                  ) : books.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {books.map((book) => {
                        const isBookActive = activeBook?.id === book.id;
                        return (
                          <button
                            key={book.id}
                            type="button"
                            onClick={() => setActiveBook(book)}
                            className={`p-3 text-xs font-bold text-left rounded-xl border-2 transition-all cursor-pointer ${
                              isBookActive
                                ? "bg-sky-50 border-sky-500 text-sky-950"
                                : "bg-white border-slate-100 hover:border-slate-300"
                            }`}
                          >
                            {book.title}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 bg-slate-50 p-3 border border-dashed border-slate-200 rounded-xl">
                      💡 Для цього предмета ще немає книг. Можна ввести текст
                      вручну нижче.
                    </div>
                  )}
                </div>
              )}
              {/* КРОК 3: Текстове поле введення матеріалу параграфа */}
              <div className="space-y-3 pt-4 border-t-2 border-slate-100">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                  📝 Крок 3: Введіть параграф або завдання підручника
                </label>

                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    activeBook
                      ? `Вставте сюди текст з підручника «${activeBook.title}»...`
                      : "Вставте сюди текст параграфа підручника НУШ або опишіть проблему..."
                  }
                  className="w-full h-36 p-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium resize-none placeholder-slate-400 bg-[#FAF9F6]/30"
                />

                <button
                  type="button"
                  onClick={handleAdaptationSubmit}
                  disabled={isGenerating || !inputText.trim()}
                  className="w-full sm:w-auto sm:float-right px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg disabled:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 outline-none focus:ring-4 focus:ring-emerald-500/30"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Адаптація...
                    </>
                  ) : (
                    "✨ Адаптувати матеріал за 10с"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
