import { NextResponse } from "next/server";
import { createServerConnection } from "@/app/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerConnection();

    // Обмінюємо тимчасовий код Google на постійну сесію в куках
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Помилка обміну коду на сесію:", error.message);
      return NextResponse.redirect(`${origin}?auth_error=failed`);
    }
  }

  // Направляємо на /dashboard. Мідлвара перехопить цей шлях
  // і сама вирішить: лишити тут чи силоміць розвернути на онбординг!
  return NextResponse.redirect(`${origin}/dashboard`);
}
