"use client";

import { createClientConnection } from "../supabase/client";

/**
 * 1. Процес входу через Google OAuth у Supabase
 */
export const signInWithGoogle = async () => {
  const supabase = createClientConnection();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error("Supabase OAuth Error:", error.message);
    throw new Error(error.message);
  }
};

/**
 * 2. Глобальний обробник кліку для кнопки Google
 */
export const handleGoogleAuthClick = async (e: React.SyntheticEvent) => {
  e.preventDefault();
  try {
    await signInWithGoogle();
  } catch (error: any) {
    alert("Не вдалося запустити вхід через Google: " + error.message);
  }
};

/**
 * 3. Розумний вхід/реєстрація через пошту з перевіркою профілю
 */
export const signInOrSignUpWithEmail = async (
  email: string,
  password: string,
) => {
  const supabase = createClientConnection();

  // Спроба увійти
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  // Якщо вхід успішний — користувач вже існує в системі автентифікації
  if (!signInError && signInData.user) {
    // Перевіряємо, чи заповнено профіль (роль) користувача
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signInData.user.id)
      .single();

    // Якщо роль NULL або профілю немає — відправляємо на онбординг (isNewUser: true)
    const isProfileIncomplete = !profile || !profile.role;
    return { user: signInData.user, isNewUser: isProfileIncomplete };
  }

  // Автоматична реєстрація нового користувача, якщо його не знайдено
  const isUserNotFound =
    signInError &&
    (signInError.status === 400 ||
      signInError.message.toLowerCase().includes("invalid") ||
      signInError.message.toLowerCase().includes("credentials"));

  if (isUserNotFound) {
    console.log("Користувача не знайдено. Автоматично реєструємо...");

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
      },
    );

    if (signUpError) throw new Error(signUpError.message);
    if (signUpData.user) {
      return { user: signUpData.user, isNewUser: true };
    }
  }

  throw new Error(signInError?.message || "Не вдалося обробити запит");
};

/**
 * 4. Функція для повного очищення сесії при виході
 */
export const handleSignOutClick = async () => {
  const supabase = createClientConnection();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
