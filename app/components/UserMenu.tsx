"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { handleSignOutClick } from "@/app/utils/auth/authService"; // 🌟 Імпорт виходу з відновленого сервісу

interface UserMenuProps {
  userLetter: string;
  userEmail: string;
}

export default function UserMenu({ userLetter, userEmail }: UserMenuProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();

  const handleLogOut = async () => {
    try {
      await handleSignOutClick(); // 🌟 Викликаємо наш чистий метод
      setShowUserMenu(false);

      // Жорсткий резистентний вихід на корінь сайту, щоб Next.js напевно збив клієнтський кеш роутера
      window.location.href = "/";
    } catch (error) {
      console.error("Помилка виходу:", error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="w-10 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center select-none shadow-xs border-b-2 border-emerald-900 cursor-pointer transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
      >
        {userLetter}
      </button>

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
  );
}
