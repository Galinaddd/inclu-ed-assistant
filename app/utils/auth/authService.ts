// app/utils/authService.ts
import { createClientConnection } from "../supabase/client";

/**
 * 1. Запускає реальний процес входу через Google OAuth у Supabase
 */
export const signInWithGoogle = async () => {
  const supabase = createClientConnection();

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
 * 🌟 2. Єдиний глобальний обробник кліку для БУДЬ-ЯКОЇ кнопки Google на сайті.
 * Виносимо його сюди за вашим планом! Він сам зупиняє браузер і запускає функцію вище.
 */
export const handleGoogleAuthClick = async (e: React.SyntheticEvent) => {
  // Автоматично зупиняємо стандартну поведінку браузера (щоб сторінка не перезавантажувалася)
  e.preventDefault();

  try {
    // Викликаємо функцію входу, яка написана вище в цьому ж файлі
    await signInWithGoogle();
  } catch (error: any) {
    // Якщо сталася помилка — показуємо віконце alert користувачу
    alert("Не вдалося запустити вхід через Google: " + error.message);
  }
};

/**
 * 3. Розумний вхід/реєстрація через пошту
 */
export const signInOrSignUpWithEmail = async (
  email: string,
  password: string,
) => {
  const supabase = createClientConnection();

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

  // 2. Якщо такого користувача немає в базі, автоматично реєструємо його
  const isUserNotFoundOrInvalid =
    signInError &&
    (signInError.status === 400 ||
      signInError.message.toLowerCase().includes("invalid") ||
      signInError.message.toLowerCase().includes("credentials"));

  if (isUserNotFoundOrInvalid) {
    console.log("Користувача не знайдено. Автоматично реєструємо...");

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

  // Якщо виникла будь-яка інша помилка (наприклад, неправильний пароль для існуючого юзера)
  throw new Error(signInError?.message || "Не вдалося обробити запит");
};
