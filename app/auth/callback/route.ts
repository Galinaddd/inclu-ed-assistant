import { NextResponse } from "next/server";
import { createServerConnection } from "@/app/utils/supabase/server"; // Імпортуємо наш готовий коннекшн

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    // 🌟 Запускаємо серверне з'єднання в один рядок замість цілого абзацу коду!
    const supabase = await createServerConnection();

    // Обмінюємо код Google на повноцінну сесію
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // 🌟 ВАША РОЗУМНА ПЕРЕВІРКА:
      // Supabase автоматично віддає дату створення акаунта та останнього входу.
      // Якщо вони майже однакові (з різницею в пару секунд), це означає, що користувач новий!
      const createdAt = new Date(data.user.created_at).getTime();
      const lastSignIn = new Date(data.user.last_sign_in_at || "").getTime();

      const isNewUser = Math.abs(lastSignIn - createdAt) < 5000; // різниця менше 5 секунд

      if (isNewUser) {
        // Якщо новий — примусово відправляємо на анкету
        return NextResponse.redirect(`${origin}/onboarding`);
      } else {
        // Якщо вже був у нас — пускаємо відразу працювати
        return NextResponse.redirect(`${origin}/dashboard`);
      }
    }
  }

  // Якщо сталася помилка — повертаємо на лендінг
  return NextResponse.redirect(`${origin}?auth_error=failed`);
}
