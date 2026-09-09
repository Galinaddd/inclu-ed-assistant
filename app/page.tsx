"use client";

import React from "react";
import { HeroTreeGraphic, GoogleBrandIcon } from "./components/graphics/Icons";
import GoogleAuthButton from "./components/GoogleAuthButton";
import { createClient } from "./utils/supabase";
import ExampleSection from "./components/ExampleSection";

export default function LandingPage() {
  const supabase = createClient();

  // Швидкий вхід через Google для головної кнопки
  const handleGoogleLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      alert("Не вдалося запустити вхід через Google: " + error.message);
    }
  };

  return (
    <div className="font-sans tracking-wide selection:bg-sky-200/60 relative overflow-x-hidden">
      {/* М'який градієнтний фон */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-sky-100/40 via-emerald-50/30 to-transparent pointer-events-none" />

      {/* ГОЛОВНИЙ БЛОК (HERO) — ПОВНІСТЮ ЯК БУЛО У ВАС */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-4 pb-12 relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
        {/* Ліва колонка (Текст + Кнопка дії) */}
        <div className="md:col-span-7 flex flex-col items-center md:items-start text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-100 border-2 border-emerald-400 rounded-full text-xs font-bold text-emerald-950 mb-6">
            🌱 Створено для підтримки дітей без стресу та сліз
          </span>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-wide text-slate-900 mb-6 leading-tight max-w-lg md:max-w-none">
            Адаптуйте шкільний матеріал під потреби дитини{" "}
            <span className="text-sky-700 underline decoration-sky-700/80 decoration-4 underline-offset-4 md:whitespace-nowrap">
              за 10 секунд
            </span>
          </h1>

          <p className="text-base md:text-lg text-slate-800 mb-8 max-w-xl leading-relaxed font-medium">
            Автоматичне спрощення текстів підручників НУШ, друк карток за
            стандартами МОН та домашній розбір складних тем у форматі цікавої
            гри чи казки.
          </p>

          <div className="w-full sm:w-[400px] flex flex-col items-center">
            {/* Головна кнопка Google входу */}
            <GoogleAuthButton onClick={handleGoogleLogin} />

            <p className="text-xs text-slate-600 font-bold mt-4 text-center w-full bg-slate-200/50 py-1 rounded-md">
              ✨ 5 безкоштовних спроб нараховуються одразу
            </p>
          </div>
        </div>

        {/* Права колонка (Блок ілюстрації та позиціонування «Для кого») */}
        <div className="md:col-span-5 flex justify-center w-full">
          <div className="bg-[#F4F1EA] p-6 rounded-3xl border-2 border-slate-300/80 shadow-sm relative max-w-xs md:max-w-sm w-full text-center">
            <HeroTreeGraphic />
            <span className="text-xs font-black text-sky-950 bg-sky-100 border border-sky-300 px-4 py-1.5 rounded-full mt-5 inline-block">
              🧠 Neurodiversity-friendly UX
            </span>
          </div>
        </div>
      </main>

      {/* СЕКЦІЯ ПРИКЛАДУ ШІ-ГЕНЕРАЦІЇ */}
      <ExampleSection />
    </div>
  );
}
