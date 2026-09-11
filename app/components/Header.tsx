"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  signInOrSignUpWithEmail,
  handleGoogleAuthClick,
  handleSignOutClick,
  getCurrentUserInitials,
} from "../utils/auth/authService";
import { useRouter, usePathname } from "next/navigation";
import Logo from "./graphics/Logo";
import GoogleAuthButton from "./GoogleAuthButton";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Керування випадаючим меню аватарки
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userLetter, setUserLetter] = useState("U");
  const [userEmail, setUserEmail] = useState("");

  // Безпечно завантажуємо літеру та емейл з нашого сервісу
  useEffect(() => {
    getCurrentUserInitials()
      .then((res) => {
        setUserLetter(res.letter);
        setUserEmail(res.email);
      })
      .catch((err) => console.error(err));
  }, [pathname]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert("Будь ласка, заповніть усі поля");

    setLoading(true);
    try {
      const result = await signInOrSignUpWithEmail(email, password);
      setShowEmailForm(false);
      setEmail("");
      setPassword("");

      if (result.isNewUser) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (error: any) {
      alert("Помилка авторизації: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Обробник кнопки виходу в меню
  const handleLogOut = async () => {
    try {
      await handleSignOutClick();
      setShowUserMenu(false);
      setShowEmailForm(false);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Помилка виходу:", error);
    }
  };

  const isDashboard = pathname.startsWith("/dashboard");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isUserLoggedIn = isDashboard || isOnboarding;
  return (
    <header
      className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-4 relative z-50 w-full"
      role="banner"
    >
      <div className="flex justify-between items-center w-full">
        <Logo />

        <div className="flex items-center gap-4">
          {/* Бонусна плашка */}
          <span className="hidden lg:inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-100 border-2 border-amber-400 rounded-full text-xs font-bold text-amber-950 shadow-xs">
            <span aria-hidden="true">🎁</span>{" "}
            {isDashboard ? "Залишилось: 5 спроб" : "Подарунок: 5 спроб"}
          </span>

          {/* ДИНАМІЧНА КНОПКА АВАТАРКИ */}
          {isUserLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center select-none shadow-xs border-b-2 border-emerald-900 cursor-pointer transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
              >
                {userLetter}
              </button>

              {/* ВИПАДАЮЧЕ МЕНЮ (Dropdown) */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Мій асистент
                      </p>
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {userEmail || "Завантаження..."}
                      </p>
                    </div>

                    <div className="p-1 space-y-0.5 text-left">
                      <button
                        onClick={() => {
                          router.push("/profile");
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                      >
                        👤 Мій профіль
                      </button>

                      <button
                        onClick={() => {
                          router.push("/onboarding");
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                      >
                        ⚙️ Змінити роль (Онбординг)
                      </button>

                      <button
                        onClick={() => {
                          router.push("/dashboard/documents");
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex justify-between items-center"
                      >
                        <span>📄 Мої документи (ІПР)</span>
                        <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-md font-black">
                          Скоро
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          router.push("/dashboard/children");
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex justify-between items-center"
                      >
                        <span>👶 Учні / Профілі дітей</span>
                        <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded-md font-black">
                          Важливо
                        </span>
                      </button>
                    </div>

                    <div className="border-t border-slate-100 mt-1 p-1">
                      <button
                        onClick={handleLogOut}
                        className="w-full text-left px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        🚪 Вийти з акаунту
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            !isOnboarding && (
              <Button
                variant="outline"
                onClick={() => setShowEmailForm(!showEmailForm)}
                aria-expanded={showEmailForm}
                className="w-24 py-2 bg-white border-2 border-slate-300 text-sm font-bold rounded-xl shadow-xs text-slate-800 hover:bg-slate-100 transition-all focus:ring-4 focus:ring-sky-600/40 cursor-pointer text-center justify-center flex shrink-0"
              >
                {showEmailForm ? "Закрити" : "Увійти"}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Форма авторизації */}
      {!isDashboard && !isOnboarding && showEmailForm && (
        <div
          className="absolute top-full right-4 left-4 md:left-auto md:right-16 mt-3 max-w-none md:max-w-sm bg-white border-2 border-slate-300 p-5 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50"
          role="dialog"
        >
          <GoogleAuthButton
            onClick={handleGoogleAuthClick}
            disabled={loading}
          />

          <div className="relative flex py-3 items-center" aria-hidden="true">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              або через email
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div className="flex flex-col text-left gap-1">
              <label
                id="header-email-label"
                className="text-[11px] font-black text-slate-500 ml-1"
              >
                Електронна пошта
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                disabled={loading}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-xl border-2 border-slate-200 bg-[#FAF9F6] px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col text-left gap-1">
              <label
                id="header-password-label"
                className="text-[11px] font-black text-slate-500 ml-1"
              >
                Пароль
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                disabled={loading}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-10 w-full rounded-xl border-2 border-slate-200 bg-[#FAF9F6] px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl h-10 text-xs border-b-4 border-emerald-950 active:border-b-0 cursor-pointer focus:outline-none focus:ring-4 focus:ring-emerald-600"
            >
              {loading ? "Перевірка..." : "Продовжити"}
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
