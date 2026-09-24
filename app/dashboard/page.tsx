"use client";

import React, { useEffect, useState, useTransition } from "react";
import { createClientConnection } from "../utils/supabase/client";
import {
  getSubjectsByChild,
  getBooksBySubject,
  getParagraphsByBook,
  getSourceParagraphContent,
  adaptMaterialAction, // Імпортуємо ШІ-екшен прямо сюди
} from "./actions";
import UploadBookModal from "./_components/UploadBookModal";
import SubjectSelector from "./_components/SubjectSelector";
import BookSelector from "./_components/BookSelector";
import ParagraphSelector from "./_components/ParagraphSelector";
import MainFormContainer from "./_components/MainFormContainer";

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

interface ParagraphData {
  id: string;
  chapter_title: string;
  paragraph_number: string;
  raw_text: string;
}

export default function DashboardPage() {
  const supabase = createClientConnection();

  // Глобальні реактивні стани диспетчера сторінки
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [activeSubject, setActiveSubject] = useState<SubjectData | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [books, setBooks] = useState<BookData[]>([]);
  const [activeBook, setActiveBook] = useState<BookData | null>(null);
  const [loadingBooks, setLoadingBooks] = useState(false);

  const [paragraphs, setParagraphs] = useState<ParagraphData[]>([]);
  const [activeParagraph, setActiveParagraph] = useState<ParagraphData | null>(
    null,
  );
  const [loadingParagraphs, setLoadingParagraphs] = useState(false);

  // ✨ Чисті стейти для передачі у форму (State Lifting)
  const [extractedText, setExtractedText] = useState("");
  const [loadingTextFromR2, setLoadingTextFromR2] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // 1. Дебаг профілю користувача
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

  // 2. Завантаження карток дітей
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
          if (parsedChildren.length === 1) setActiveChild(parsedChildren[0]);
        }
      } catch (err) {
        console.error("Не вдалося підтягнути профілі учнів:", err);
      } finally {
        setLoadingChildren(false);
      }
    };
    fetchChildrenData();
  }, [supabase]);

  // 3. Динамічний фетч предметів
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
      setParagraphs([]);
      setActiveParagraph(null);
      setExtractedText("");
      setAiResponse("");
      setAiErrorMessage(null);

      const res = await getSubjectsByChild(
        activeChild.school_class!,
        activeChild.program_id,
      );
      if (res.success) setSubjects(res.data);
      setLoadingSubjects(false);
    });
  }, [activeChild]);

  // 4. Динамічний фетч книг
  useEffect(() => {
    if (!activeSubject || !activeChild?.school_class) {
      setBooks([]);
      setActiveBook(null);
      return;
    }
    startTransition(async () => {
      setLoadingBooks(true);
      setActiveBook(null);
      setParagraphs([]);
      setActiveParagraph(null);
      setExtractedText("");
      setAiResponse("");
      setAiErrorMessage(null);

      const res = await getBooksBySubject(
        activeSubject.id,
        activeChild.school_class!,
      );
      if (res.success) setBooks(res.data);
      setLoadingBooks(false);
    });
  }, [activeSubject, activeChild]);

  // 5. Динамічний фетч параграфів (З урахуванням parent_book_id)
  useEffect(() => {
    if (!activeBook) {
      setParagraphs([]);
      setActiveParagraph(null);
      return;
    }
    startTransition(async () => {
      setLoadingParagraphs(true);
      setActiveParagraph(null);
      setExtractedText("");
      setAiResponse("");
      setAiErrorMessage(null);

      const res = await getParagraphsByBook(activeBook.id);
      if (res.success) setParagraphs(res.data);
      setLoadingParagraphs(false);
    });
  }, [activeBook]);

  // ✨ 6. АВТОМАТИЧНЕ СТЯГУВАННЯ ТЕКСТУ З R2 ПРИ КЛІКУ НА ПАРАГРАФ
  useEffect(() => {
    if (!activeParagraph) return;
    const fetchR2Content = async () => {
      setLoadingTextFromR2(true);
      try {
        const res = await getSourceParagraphContent(activeParagraph.raw_text);
        if (res.success) setExtractedText(res.data);
      } catch (err) {
        console.error("Помилка при читанні параграфа з R2:", err);
      } finally {
        setLoadingTextFromR2(false);
      }
    };
    fetchR2Content();
  }, [activeParagraph]);

  // ✨ 7. ГОЛОВНА БОЙОВА ФУНКЦІЯ ШІ-ОБРОБКИ ДЛЯ ФОРМИ
  const handleFormSubmit = async (formData: { text: string; tab: string }) => {
    if (!activeChild || !activeSubject) return;

    setIsGenerating(true);
    setAiErrorMessage(null);
    setAiResponse("");

    startTransition(async () => {
      try {
        const result = await adaptMaterialAction({
          text: formData.tab === "text" ? formData.text : `[Файл завантажено]`,
          childId: activeChild.id,
          userRole: "teacher",
          subjectName: activeSubject.subject_name,
        });

        if (result.success && result.data) {
          setAiResponse(result.data);
        } else {
          setAiErrorMessage(
            result.error || "Сталася помилка під час генерації ШІ.",
          );
        }
      } catch (err: any) {
        setAiErrorMessage(err.message || "Непередбачена помилка сервера.");
      } finally {
        setIsGenerating(false);
      }
    });
  };
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

        {/* ПРАВА ПАНЕЛЬ — ГОЛОВНА РОБОЧА ЗОНА */}
        <div className="lg:col-span-8 flex flex-col gap-5 w-full">
          {activeChild ? (
            <div className="space-y-5 w-full">
              {/* Атом 1: Селектор предметів */}
              <SubjectSelector
                childName={activeChild.child_name}
                subjects={subjects}
                activeSubject={activeSubject}
                setActiveSubject={setActiveSubject}
              />

              {/* Атом 2: Селектор підручників */}
              {activeSubject && (
                <BookSelector
                  subjectName={activeSubject.subject_name}
                  books={books}
                  activeBook={activeBook}
                  setActiveBook={setActiveBook}
                  setIsUploadOpen={setIsUploadOpen}
                />
              )}

              {/* Атом 3: Селектор глав та параграфів */}
              {activeBook && (
                <ParagraphSelector
                  paragraphs={paragraphs}
                  activeParagraph={activeParagraph}
                  setActiveParagraph={setActiveParagraph}
                  loadingParagraphs={loadingParagraphs}
                />
              )}

              {/* Атом 4: Очищена компактна форма генерації (State Lifting) */}
              <MainFormContainer
                inputText={extractedText}
                setInputText={setExtractedText}
                loadingTextFromR2={loadingTextFromR2}
                isGenerating={isGenerating}
                onSubmit={handleFormSubmit}
                aiResponse={aiResponse}
                errorMessage={aiErrorMessage}
              />
            </div>
          ) : (
            <div className="bg-card border-2 border-border p-10 rounded-3xl text-center text-muted-foreground font-bold text-sm shadow-xs">
              😴 Оберіть картку учня ліворуч, щоб почати роботу.
            </div>
          )}
        </div>
      </main>

      {/* Глобальна модалка додавання підручника (Помилку ліквідовано завдяки subjectName) */}
      <UploadBookModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        subjectId={activeSubject?.id || ""}
        subjectName={activeSubject?.subject_name || ""}
        schoolClass={activeChild?.school_class || 0}
        programId={activeChild?.program_id || null}
      />
    </div>
  );
}
