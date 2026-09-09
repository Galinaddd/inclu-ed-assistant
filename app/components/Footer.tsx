"use client";

import React, { useState } from "react";

export default function Footer() {
  const [suggestion, setSuggestion] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestionSubmitted, setSuggestionSubmitted] = useState(false);

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion || !userEmail) return;

    setLoading(true);
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          text: suggestion,
          createdAt: new Date().toISOString(),
          role: "suggestion",
        }),
      });

      if (!response.ok) throw new Error("Помилка сервера");

      setSuggestionSubmitted(true);
      setSuggestion("");
      setUserEmail("");
    } catch (error: any) {
      alert("Не вдалося відправити: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer
      className="border-t-2 border-slate-200 bg-[#F4F1EA]/60 mt-12 relative z-10"
      role="contentinfo"
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Головний контейнер: ділить підвал на Ліво і Право */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8 pb-6 border-b border-slate-300/40">
          {/* ЛІВА ЧАСТИНА: Логотип (ПОВНІСТЬЮ ідентичний вашій шапці з прозорістю) */}
          <div className="flex flex-col items-center lg:items-start gap-3 lg:pt-1">
            <span className="text-xl font-black tracking-tight select-none flex items-baseline gap-0.5">
              <span className="text-sky-900/80">Inclu</span>
              <span className="text-sky-700/80">Ed</span>
              <span className="text-emerald-700">Assistant</span>
              <span className="text-sky-900 font-medium text-xs">.ai</span>
            </span>

            <nav
              className="flex gap-4 text-xs font-bold text-slate-500"
              aria-label="Юридична інформація"
            >
              <a
                href="/privacy"
                className="hover:text-sky-700 underline underline-offset-4 transition-colors"
              >
                Політика
              </a>
              <a
                href="/terms"
                className="hover:text-sky-700 underline underline-offset-4 transition-colors"
              >
                Умови
              </a>
              <a
                href="mailto:support@incluedassistant.ai"
                className="hover:text-emerald-700 underline underline-offset-4 transition-colors"
              >
                Підтримка
              </a>
            </nav>
          </div>

          {/* ПРАВА ЧАСТИНА: Форма пропозицій з ніжними заспокійливими кольорами */}
          <div
            className="w-full max-w-sm lg:max-w-md"
            role="form"
            aria-label="Форма пропозицій"
          >
            {suggestionSubmitted ? (
              <div
                role="status"
                aria-live="polite"
                className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-emerald-950 font-bold text-xs text-center animate-in zoom-in-95"
              >
                ✨ Дякуємо! Ми врахуємо вашу пропозицію при розвитку платформи.
              </div>
            ) : (
              <form
                onSubmit={handleSuggestionSubmit}
                className="flex flex-col gap-3 w-full"
              >
                {/* Поле великого тексту */}
                <div className="flex flex-col gap-1 w-full text-left">
                  <label
                    id="footer-suggest-label"
                    className="text-[11px] font-bold text-slate-500 ml-1"
                  >
                    Яких інклюзивних інструментів вам не вистачає?
                  </label>
                  <textarea
                    rows={2}
                    value={suggestion}
                    disabled={loading}
                    onChange={(e) => setSuggestion(e.target.value)}
                    aria-labelledby="footer-suggest-label"
                    placeholder="Напишіть вашу ідею чи побажання..."
                    className="w-full rounded-xl border-2 border-slate-200 bg-white/80 px-3 py-2 text-xs md:text-sm font-medium text-slate-900 focus:outline-none focus:border-sky-600 transition-all resize-none disabled:opacity-60 min-h-[54px]"
                    required
                  />
                </div>

                {/* Поле Email строго під текстом */}
                <div className="flex flex-col gap-1 w-full text-left">
                  <input
                    type="email"
                    value={userEmail}
                    disabled={loading}
                    onChange={(e) => setUserEmail(e.target.value)}
                    aria-label="Ваш Email"
                    placeholder="Ваш Email для зворотного зв'язку"
                    className="h-9 px-3 w-full rounded-xl border-2 border-slate-200 bg-white/80 text-xs md:text-sm font-medium text-slate-900 focus:outline-none focus:border-sky-600 disabled:opacity-60"
                    required
                  />
                </div>

                {/* Кнопка — змінено з важкого slate-800 на ваш фірмовий смарагд з плавною тінню */}
                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black px-4 rounded-xl text-xs md:text-sm border-b-4 border-emerald-900 active:border-b-0 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {loading ? "Надсилаємо..." : "Надіслати пропозицію"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Копірайт та відповідність стандартам */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
          <div>
            Створено з турботою в Україні. <span aria-hidden="true">🇺🇦</span>
          </div>
          <div className="text-slate-500">
            Відповідає стандартам НУШ та вимогам МОН України.
          </div>
          <div>{new Date().getFullYear()} — IncluEdAssistant.ai</div>
        </div>
      </div>
    </footer>
  );
}
