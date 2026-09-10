// app/components/AuthRedirectProvider.tsx
"use client"; // Цей рядок обов'язковий, бо код працює в браузері (використовує стейти та ефекти)

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClientConnection } from "../utils/supabase/client"; // Наш браузерний коннекшн до бази даних
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

export default function AuthRedirectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter(); // Інструмент для редіректів (програмного перемикання сторінок)
  const pathname = usePathname(); // Інструмент, який зчитує поточну адресу в браузері (наприклад, '/' чи '/dashboard')

  // 1. СТАН БЛОКУВАННЯ ЕКРАНА (checkingAuth)
  // За замовчуванням ставимо true. Це означає: "Поки ми не дізнаємося від Supabase через куки,
  // хто саме зайшов на сайт, ми тримаємо захисний екран завантаження і сам сайт не показуємо".
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 2. ІНІЦІАЛІЗАЦІЯ ЗВ'ЯЗКУ
  // Створюємо екземпляр клієнта Supabase для браузера. Він вміє зчитувати поточні сесійні куки.
  const supabase = createClientConnection();

  useEffect(() => {
    // 3. ПІДПИСКА НА ПОДІЇ АВТОРИЗАЦІЇ (onAuthStateChange)
    // Це «вічний слухач» подій. Як тільки цей провайдер завантажується, цей метод робить швидкий
    // фоновий запит до кук, щоб дізнатися, чи є активна сесія (session), і продовжує стежити за нею.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        try {
          // --- СЦЕНАРІЙ А: КОРИСТУВАЧ АВТОРcomponentsИЗОВАНИЙ (session існує) ---
          if (session) {
            // Умова 1: Якщо користувач успішно увійшов, але браузер зараз стоїть на лендінгу "/"
            if (pathname === "/") {
              // Кажемо браузеру: "Йому тут робити нічого, перекидай його в особистий кабінет"
              router.push("/dashboard");
              // Зверніть увагу: ми НЕ вимикаємо тут checkingAuth (він залишається true),
              // тому користувач не побачить форму входу лендінгу навіть на мілісекунду!
            }

            // Умова 2: Якщо він увійшов і зараз проходить анкету на сторінці онбордингу
            else if (pathname === "/onboarding") {
              // Знімаємо блок екрана! Показуємо сторінку анкети, нехай спокійно заповнює поля.
              setCheckingAuth(false);
            }

            // Умова 3: У всіх інших випадках всередині робочого кабінету (наприклад, на /dashboard)
            else {
              // Знімаємо блок екрана! Дозволяємо працювати з ШІ-панеллю.
              setCheckingAuth(false);
            }
          }

          // --- СЦЕНАРІЙ Б: КОРИСТУВАЧ ГІСТЬ (session порожня, дорівнює null) ---
          else {
            // Умова 4: ЗАХИСТ НА ФРОНТЕНДІ. Якщо сесії в куках немає, а людина намагається сидіти на внутрішніх сторінках
            if (
              pathname.startsWith("/dashboard") ||
              pathname === "/onboarding"
            ) {
              // Миттєво виштовхуємо її назад на головну сторінку
              router.push("/");
              // Блок екрана залишається увімкненим (true), щоб користувач не побачив захищений інтерфейс кабінету
            }

            // Умова 5: Якщо сесії немає і користувач чесно зайшов просто на посадкову сторінку "/"
            else {
              // Знімаємо блок екрана! Показуємо йому форму входу ("Запуск...", "Перевірка...")
              setCheckingAuth(false);
            }
          }
        } catch (error) {
          console.error("Помилка обробки захисту роутів:", error);
          setCheckingAuth(false);
        }
      },
    );

    // 4. АВТОМАТИЧНЕ ВІДПИСУВАННЯ (ОЧИЩЕННЯ ПАМ'ЯТІ)
    // Якщо користувач закриє вкладку або вийде, цей ретун видалить слухача подій, щоб додаток не лагав
    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase.auth]);

  // 5. РЕНДЕРИНГ ПУЛЬСУЮЧОГО ЕКРАНА ЗАВАНТАЖЕННЯ
  // Якщо стейт checkingAuth досі true, І користувач знаходиться на одній із трьох головних сторінок,
  // ми зупиняємо рендеринг сайту і повертаємо велику інклюзивну заглушку безпеки.
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

  // 6. РЕНДЕРИНГ САМОГО САЙТУ
  // Якщо checkingAuth перемикається в false — цей блок пропускає код далі,
  // і Next.js малює сторінку, на яку прийшов користувач (замість тегу {children})
  return <>{children}</>;
}
