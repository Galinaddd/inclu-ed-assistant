"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../utils/supabase";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

export default function AuthRedirectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Ініціалізуємо ваш браузерний клієнт Supabase
  const supabase = createClient();

  useEffect(() => {
    // 🌟 Офіційний слухач подій: стежить за авторизацією та захищає сторінки
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        try {
          if (session) {
            // 1. Якщо користувач увійшов і знаходиться на лендінгу
            if (pathname === "/") {
              router.push("/dashboard");
            }
            // 2. Якщо користувач увійшов і зараз проходить анкету
            else if (pathname === "/onboarding") {
              setCheckingAuth(false); // Дозволяємо спокійно заповнювати поля, не редіректимо на дашборд завчасно
            }
            // 3. У всіх інших випадках всередині кабінету
            else {
              setCheckingAuth(false);
            }
          } else {
            // 4. ЗАХИСТ: Якщо сесії немає, а користувач намагається зайти на закриті сторінки
            if (
              pathname.startsWith("/dashboard") ||
              pathname === "/onboarding"
            ) {
              router.push("/");
            } else {
              setCheckingAuth(false);
            }
          }
        } catch (error) {
          console.error("Помилка обробки захисту роутів:", error);
          setCheckingAuth(false);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase.auth]);

  // Ваш фірмовий інклюзивний пульсуючий екран завантаження
  // Він показується тільки на критичних роутах, поки Supabase перевіряє токени
  if (
    checkingAuth &&
    (pathname === "/" ||
      pathname.startsWith("/dashboard") ||
      pathname === "/onboarding")
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF9F6] font-sans font-black text-slate-700">
        <div className="animate-pulse text-sm select-none tracking-tight">
          Завантаження безпечної сесії Supabase...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
