import React from "react";
import { createServerConnection } from "@/app/utils/supabase/server"; // Твій чистий серверний коннекшн
import Logo from "./graphics/Logo";
import AuthZone from "./AuthZone";
import UserMenu from "./UserMenu";

export default async function Header() {
  // 1. Ініціалізуємо Supabase-клієнт на сервері (миттєва перевірка куків сесії)
  const supabase = await createServerConnection();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userLetter = "U";
  let creditsLeft = 5; // Дефолтне значення на випадок, якщо профіль ще створюється
  const userEmail = user?.email || "";

  if (user) {
    // 2. 🌟 ДОДАЛИ ai_credits_left У ЗАПИТ З БАЗИ ПРОФІЛІВ
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, ai_credits_left")
      .eq("id", user.id)
      .maybeSingle();

    // Синхронний ланцюжок без затримок: Профіль БД -> Метадані Google -> Email
    const nameToUse =
      profile?.full_name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      userEmail;
    userLetter = nameToUse ? nameToUse.charAt(0).toUpperCase() : "U";

    // 🌟 Оновлюємо кількість спроб з бази, якщо запис існує
    if (profile && typeof profile.ai_credits_left === "number") {
      creditsLeft = profile.ai_credits_left;
    }
  }

  // Користувач вважається залогіненим, якщо сервер чітко бачить active user
  const isUserLoggedIn = !!user;

  return (
    <header
      className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-4 relative z-50 w-full"
      role="banner"
    >
      <div className="flex justify-between items-center w-full">
        <Logo />

        <div className="flex items-center gap-4">
          {/* 🌟 БОНУСНА ПЛАШКА: Тепер виводить реальну цифру creditsLeft з бази */}
          <span className="hidden lg:inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-100 border-2 border-amber-400 rounded-full text-xs font-bold text-amber-950 shadow-xs">
            <span aria-hidden="true">🎁</span>{" "}
            {isUserLoggedIn
              ? `Залишилось: ${creditsLeft} спроб`
              : `Подарунок: ${creditsLeft} спроб`}
          </span>

          {/* СЕРВЕРНИЙ ДИСПЕТЧЕР: Рендериться миттєво без жодних мікро-скачків літер */}
          {isUserLoggedIn ? (
            <UserMenu userLetter={userLetter} userEmail={userEmail} />
          ) : (
            <AuthZone />
          )}
        </div>
      </div>
    </header>
  );
}
