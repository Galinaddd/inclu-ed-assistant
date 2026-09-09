import { createClient } from "./supabase";

/**
 * Запускає реальний процес входу через Google OAuth у Supabase
 */
export const signInWithGoogle = async () => {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Адреса, куди Google поверне користувача після авторизації
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error("Supabase OAuth Error:", error.message);
    throw new Error(error.message);
  }
};

/**
 * Розумний вхід/реєстрація через пошту
 * Якщо користувач вже є в базі — логінить, якщо немає — автоматично створює акаунт
 */
export const signInOrSignUpWithEmail = async (
  email: string,
  password: string,
) => {
  const { createClient } = await import("./supabase"); // динамічний імпорт вашого клієнта
  const supabase = createClient();

  // 1. Спочатку пробуємо увійти
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  // Якщо вхід успішний — користувач вже існує
  if (!signInError && signInData.user) {
    return { user: signInData.user, isNewUser: false };
  }

  // 2. Якщо такого користувача немає, автоматично реєструємо його
  if (
    signInError &&
    (signInError.message.includes("Invalid login credentials") ||
      signInError.status === 400)
  ) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
      },
    );

    if (signUpError) {
      throw new Error(signUpError.message);
    }

    if (signUpData.user) {
      return { user: signUpData.user, isNewUser: true };
    }
  }

  // Якщо виникла будь-яка інша помилка (наприклад, невалідний email)
  throw new Error(signInError?.message || "Не вдалося обробити запит");
};
