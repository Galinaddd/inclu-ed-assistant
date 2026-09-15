"use client";

import React, { useEffect, useState } from "react";
import { createClientConnection } from "../utils/supabase/client";

console.log("dashboard/page is working");

interface ChildProfile {
  id: string;
  user_id: string;
  child_name: string;
  child_profile: string;
  support_level: number;
  child_age: number | null;
  school_class: number | null;
  ref_diagnoses?: {
    title: string;
  };
}

export default function DashboardPage() {
  const supabase = createClientConnection();

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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
          .select(
            `
            *,
            ref_diagnoses (
              title
            )
          `,
          )
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (data && !error) {
          const parsedChildren = data as unknown as ChildProfile[];
          setChildren(parsedChildren);

          // 🔮 ТВОЄ РОЗУМНЕ UX-ПРАВИЛО КІЛЬКОСТІ:
          // Якщо дитина всього одна — вибираємо її автоматично
          if (parsedChildren.length === 1) {
            setActiveChild(parsedChildren[0]);
          } else {
            // Якщо дітей дві або більше — залишаємо null, щоб змусити вчителя/батька зробити вибір
            setActiveChild(null);
          }
        }
        if (error) console.error("Помилка завантаження дітей:", error.message);
      } catch (err) {
        console.error("Не вдалося підтягнути профілі учнів:", err);
      }
      {
        // Заміни рядок 91 на цей:
        setLoadingChildren(false); // Твій рідний стейт завершення завантаження учнів
        false; // Твій рідний стейт завершення завантаження
      }
    };
    fetchChildrenData();
  }, [supabase]);

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
              /* МАГІЯ ВЕРСТКИ: 
                 - На мобілках: flex-row + overflow-x-auto + snap-x (горизонтальний скрол картками)
                 - На десктопі (lg:): flex-col + overflow-y-auto (класична бічна вертикальна панель)
              */
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
                          <span>School Class: {child.school_class}</span>
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

        {/* ПРАВА ПАНЕЛЬ — ТЕКСТ ТА МАЙБУТНЯ СІТКА ПРЕДМЕТІВ */}
        <div className="lg:col-span-8 bg-white border-2 border-slate-200 p-5 md:p-6 rounded-2xl shadow-xs flex flex-col gap-4 text-left w-full h-fit">
          {activeChild ? (
            <div className="space-y-4 flex flex-col h-full justify-between w-full">
              <div>
                <h2 className="font-black text-lg md:text-xl text-slate-900 tracking-tight flex items-center gap-1.5 flex-wrap">
                  Введіть матеріал підручника НУШ для{" "}
                  <span className="text-emerald-700 font-black">
                    «{activeChild.child_name}»
                  </span>
                </h2>
                <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">
                  Матеріал буде адаптовано автоматично під{" "}
                  <strong>
                    {activeChild.support_level}-й рівень підтримки МОН
                  </strong>{" "}
                  та профіль{" "}
                  <strong>
                    {activeChild.ref_diagnoses?.title ||
                      activeChild.child_profile}
                  </strong>{" "}
                  для {activeChild.school_class}-го класу.
                </p>
              </div>

              {/* 🌐 НАСТУПНИЙ КРОК: СІТКА ПРЕДМЕТІВ */}
              <div className="p-4 bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl text-xs font-bold text-slate-500 text-center w-full">
                🌐 [Тут завантажаться предмети для {activeChild.school_class}-го
                класу з таблиці `program_subjects`]
              </div>

              <textarea
                rows={6}
                value={inputText}
                disabled={isGenerating}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Наприклад: Тема уроку — Фотосинтез..."
                className="w-full rounded-xl border-2 border-slate-200 bg-[#FAF9F6] p-4 text-xs md:text-sm font-medium text-slate-900 focus:outline-none focus:border-sky-600 transition-all resize-none min-h-[150px] disabled:opacity-60"
              />

              <button
                disabled={isGenerating || !inputText}
                className="w-full sm:w-fit self-end inline-flex justify-center items-center px-6 h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-xs text-xs md:text-sm border-b-4 border-emerald-900 active:border-b-0 cursor-pointer disabled:opacity-40 transition-all"
              >
                {isGenerating
                  ? "Обробка матеріалу..."
                  : "✨ Адаптувати матеріал за 10с"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-sm w-full">
              <span>👈</span> Оберіть дитину зі списку ліворуч, щоб розпочати
              роботу
            </div>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-slate-200/60 py-6 text-center text-[10px] font-bold text-slate-400">
        © {new Date().getFullYear()} — Панель управління IncluEdAssistant.ai
      </footer>
    </div>
  );
}
