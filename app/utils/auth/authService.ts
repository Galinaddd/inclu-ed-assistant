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
    // 🌟 РОЗУМНА ПЕРЕВІРКА: Перевіряємо, чи заповнено профіль (роль) користувача
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

/**
 * 5. Розумна функція визначення літери для аватарки
 */
export const getCurrentUserInitials = async (): Promise<{
  letter: string;
  email: string;
}> => {
  const supabase = createClientConnection();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 🌟 КРИТИЧНИЙ ЗАПОБІЖНИК: Захищає від крашу системи, якщо сесія закрита
  if (!user) return { letter: "U", email: "" };

  try {
    // Шукаємо ім'я в реальній таблиці profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    if (!profileError && profile?.full_name) {
      // Якщо в базі замість імені лежав email — витягуємо першу літеру пошти, інакше літеру імені
      const cleanName = profile.full_name.trim();
      return {
        letter: cleanName.charAt(0).toUpperCase(),
        email: user.email || "",
      };
    }
  } catch (err) {
    console.log("Профіль ще порожній, переходимо до метаданих...");
  }

  // ФОЛБЕК 1: Метадані Google
  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.display_name;
  if (fullName) {
    return {
      letter: fullName.trim().charAt(0).toUpperCase(),
      email: user.email || "",
    };
  }

  // ФОЛБЕК 2: Перша літера пошти
  const emailLetter = user.email
    ? user.email.trim().charAt(0).toUpperCase()
    : "U";
  return { letter: emailLetter, email: user.email || "" };
};
