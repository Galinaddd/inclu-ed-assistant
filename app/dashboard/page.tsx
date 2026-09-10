"use client";

import React, { useEffect, useState } from "react";
import { createClientConnection } from "../utils/supabase/client"; // Оновили імпорт та шлях

console.log("dashboard/page is working");

interface ChildProfile {
  id: string;
  child_name: string;
  child_profile: string;
  support_level: number;
  child_age: number | null;
}

export default function DashboardPage() {
  // Ініціалізуємо ваш клієнтський коннекшн Supabase
  const supabase = createClientConnection(); // Викликаємо правильну функцію

  const [child, setChild] = useState<ChildProfile | null>(null);
  const [loadingChild, setLoadingChild] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchChildData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data, error } = await supabase
          .from("children_profiles")
          .select("*")
          .eq("parent_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (data && !error) setChild(data);
      } catch (err) {
        console.error("Не вдалося підтягнути профіль учня:", err);
      } finally {
        setLoadingChild(false);
      }
    };
    fetchChildData();
  }, [supabase]);

  const getProfileTitle = (code: string) => {
    const titles: Record<string, string> = {
      ras: "🧩 Розлади автистичного спектра (РАС)",
      sduh: "⚡ Синдром дефіциту уваги (СДУГ)",
      dyslexia: "📖 Труднощі навчання (Дислексія)",
      zpr: "🧠 Затримка психічного розвитку (ЗПР)",
      int_dis: "🎓 Інтелектуальні порушення",
      tpm: "🗣️ Тяжкі порушення мовлення (ТПМ)",
      blind: "🕶️ Порушення зору",
      deaf: "👂 Порушення слуху",
      oda: "♿ Порушення опорно-рухового апарату",
      soc_cultural: "🌍 Соціокультурні труднощі",
      none: "🌱 Загальна адаптація матеріалу",
    };
    return titles[code] || "🧬 Особливий профіль навчання";
  };

  return (
    <div className="bg-[#FAF9F6] font-sans text-slate-900 flex flex-col justify-between min-h-[calc(100vh-88px)]">
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* ЛІВА ПАНЕЛЬ */}
        <div className="lg:col-span-4 bg-white border-2 border-slate-200 p-5 rounded-2xl h-fit shadow-xs text-left">
          <h2 className="font-black text-base text-slate-900 mb-4 flex items-center gap-2">
            🧠 Налаштування ШІ-адаптації
          </h2>
          {loadingChild ? (
            <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse">
              Зчитуємо картку учня з базы...
            </div>
          ) : child ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 bg-emerald-50/50 border-2 border-emerald-200 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-1">
                  🧬 Профіль учня з анкети:
                </span>
                <p className="text-sm font-black text-slate-900">
                  {getProfileTitle(child.child_profile)}
                </p>
                {child.child_age && (
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    🧒 Вік: {child.child_age} років
                  </p>
                )}
              </div>
              <div className="p-4 bg-sky-50/50 border-2 border-sky-200 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 block mb-1">
                  🎯 Рівень підтримки МОН:
                </span>
                <p className="text-sm font-black text-slate-900">
                  {child.support_level} рівень підтримки
                </p>
              </div>
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

        {/* ПРАВА ПАНЕЛЬ */}
        <div className="lg:col-span-8 bg-white border-2 border-slate-200 p-5 md:p-6 rounded-2xl shadow-xs flex flex-col gap-4 text-left">
          <div>
            <h2 className="font-black text-lg md:text-xl text-slate-900 tracking-tight">
              Введіть матеріал підручника НУШ
            </h2>
            <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">
              Вставте текст параграфа або тему уроку, яку потрібно терміново
              адаптувати для дитина.
            </p>
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
            className="w-full sm:w-fit self-end inline-flex justify-center items-center px-6 h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-xs text-xs md:text-sm border-b-4 border-emerald-900 active:border-b-0 cursor-pointer disabled:opacity-40"
          >
            {isGenerating
              ? "Обробка матеріалу..."
              : "✨ Адаптувати матеріал за 10с"}
          </button>
        </div>
      </main>
      <footer className="w-full border-t border-slate-200/60 py-6 text-center text-[10px] font-bold text-slate-400">
        © {new Date().getFullYear()} — Панель управління IncluEdAssistant.ai
      </footer>
    </div>
  );
}
