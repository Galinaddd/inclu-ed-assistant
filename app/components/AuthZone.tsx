"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import GoogleAuthButton from "./GoogleAuthButton";
import {
  signInOrSignUpWithEmail,
  handleGoogleAuthClick,
} from "@/app/utils/auth/authService"; // 🌟 Імпорт обох функцій з сервісу
import { useRouter } from "next/navigation";

export default function AuthZone() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const router = useRouter();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert("Будь ласка, заповніть усі поля");

    setLoading(true);
    try {
      await signInOrSignUpWithEmail(email, password);
      setShowEmailForm(false);
      setEmail("");
      setPassword("");

      // Після успішного входу поштою робимо refresh, щоб мідлвара відразу перехопила сесію
      router.refresh();
    } catch (error: any) {
      alert("Помилка авторизації: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <Button
        variant="outline"
        onClick={() => setShowEmailForm(!showEmailForm)}
        aria-expanded={showEmailForm}
        className="w-24 py-2 bg-white border-2 border-slate-800 text-sm font-bold rounded-xl shadow-xs text-slate-800 hover:bg-slate-100 transition-all cursor-pointer text-center justify-center flex shrink-0"
      >
        {showEmailForm ? "Закрити" : "Увійти"}
      </Button>

      {showEmailForm && (
        <>
          <div
            className="fixed inset-0 bg-black/10 md:bg-transparent z-40 cursor-pointer"
            onClick={() => setShowEmailForm(false)}
          />

          <div className="fixed inset-0 m-auto h-fit w-[310px] md:absolute md:top-full md:right-0 md:left-auto md:mt-3 bg-white border-2 border-slate-300 p-5 rounded-3xl shadow-xl z-50 animate-in fade-in zoom-in-95 md:zoom-in-100 md:slide-in-from-top-2 duration-150 flex flex-col">
            <div className="w-full">
              <GoogleAuthButton
                onClick={handleGoogleAuthClick}
                disabled={loading}
              />
            </div>

            <div className="my-3 text-center text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              або через email
            </div>

            <form
              onSubmit={handleEmailAuth}
              className="space-y-3 w-full flex flex-col"
            >
              <div className="w-full text-left">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 pl-1">
                  Електронна пошта
                </label>
                <input
                  type="email"
                  placeholder="galkozavrik125@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-slate-700 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="w-full text-left">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 pl-1">
                  Пароль
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-slate-700 outline-none focus:border-emerald-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#007f5f] hover:bg-[#00644b] text-white text-xs font-bold rounded-full transition-all shadow-md mt-2 cursor-pointer text-center justify-center flex"
              >
                {loading ? "Вхід..." : "Продовжити"}
              </button>
            </form>

            <div className="mt-4 text-[10px] font-bold text-slate-400 flex items-center gap-1 justify-center w-full">
              <span>🧠</span> Neurodiversity-friendly UX
            </div>
          </div>
        </>
      )}
    </div>
  );
}
