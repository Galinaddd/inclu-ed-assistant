import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // Ігноруємо помилки редіректу в Middleware
            }
          },
        },
      },
    );

    // Обмінюємо код Google на повноцінну сесію
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // 🌟 РОЗУМНА ПЕРЕВІРКА:
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
