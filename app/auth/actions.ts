"use server";

import { createServerConnection } from "@/app/utils/supabase/server";
import { redirect } from "next/navigation";

export async function loginWithEmailAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Будь ласка, заповніть усі поля" };
  }

  const supabase = await createServerConnection();

  // 1. Спроба входу прямо на сервері (куки залізно запишуться в браузер)
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  let user = signInData?.user;

  // 2. Автоматична реєстрація нового користувача, якщо його не знайдено
  const isUserNotFound =
    signInError &&
    (signInError.status === 400 ||
      signInError.message.toLowerCase().includes("invalid") ||
      signInError.message.toLowerCase().includes("credentials"));

  if (isUserNotFound) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
      },
    );

    if (signUpError) return { error: signUpError.message };
    user = signUpData?.user;
  } else if (signInError) {
    return { error: signInError.message };
  }

  if (!user) return { error: "Помилка автентифікації" };

  // 3. СЕРВЕРНИЙ РЕДІРЕКТ: Штовхаємо на дашборд.
  // Наша мідлвара сама перехопить цей рух, гляне на роль і вирішить, куди пустити!
  redirect("/dashboard");
}
