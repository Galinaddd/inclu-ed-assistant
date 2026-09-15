import React from "react";
import { headers } from "next/headers";
import { createServerConnection } from "@/app/utils/supabase/server"; // Твій чистий серверний коннекшн
import Logo from "./graphics/Logo";
import AuthZone from "./AuthZone";
import UserMenu from "./UserMenu";

export default async function Header() {
  // 1. Читаємо поточні хедери, щоб дізнатися адресу (pathname) на сервері
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-path") || "";

  // 2. Ініціалізуємо Supabase-клієнт на сервері (миттєва перевірка куків сесії)
  const supabase = await createServerConnection();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userLetter = "U";
  let userEmail = user?.email || "";

  if (user) {
    // 3. Якщо користувач увійшов, швиденько підтягуємо його ім'я з бази profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Синхронний ланцюжок без затримок: Профіль БД -> Метадані Google -> Email
    const nameToUse =
      profile?.full_name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      userEmail;
    userLetter = nameToUse ? nameToUse.charAt(0).toUpperCase() : "U";
  }

  const isDashboard = pathname.startsWith("/dashboard");
  const isOnboarding = pathname.startsWith("/onboarding");

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
          {/* Бонусна плашка спроб */}
          <span className="hidden lg:inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-100 border-2 border-amber-400 rounded-full text-xs font-bold text-amber-950 shadow-xs">
            <span aria-hidden="true">🎁</span>{" "}
            {isDashboard ? "Залишилось: 5 спроб" : "Подарунок: 5 спроб"}
          </span>

          {/* СЕРВЕРНИЙ ДИСПЕТЧЕР: Рендериться миттєво без жодних мікро-скачків літер */}
          {isUserLoggedIn ? (
            <UserMenu userLetter={userLetter} userEmail={userEmail} />
          ) : (
            !isOnboarding && <AuthZone />
          )}
        </div>
      </div>
    </header>
  );
}
