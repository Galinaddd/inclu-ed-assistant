import { NextResponse, type NextRequest } from "next/server";
import { createServerConnection } from "@/app/utils/supabase/server";

export async function middleware(request: NextRequest) {
  const supabase = await createServerConnection();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentPath = request.nextUrl.pathname;
  const url = request.nextUrl.clone();

  // 1. Пропускаємо системні маршрути авторизації Next/Supabase
  if (currentPath.startsWith("/auth")) {
    return NextResponse.next();
  }

  // 2. ГОСТІ (Користувач НЕ увійшов)
  if (!user) {
    if (currentPath !== "/") {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 3. АВТОРИЗОВАНІ КОРИСТУВАЧІ: Перевіряємо роль у public.profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Строго звіряємо значення з твоїм SQL CHECK CONSTRAINT ('teacher' або 'parent')
  const currentRole = profile?.role;
  const isRoleValid = currentRole === "teacher" || currentRole === "parent";

  // Сценарій А: Онбординг НЕ пройдено (немає валідної ролі в базі)
  if (!isRoleValid) {
    if (currentPath !== "/onboarding") {
      url.pathname = "/onboarding";
      return NextResponse.redirect(url); // Силоміць повертаємо на анкету
    }
    return NextResponse.next();
  }

  // Сценарій Б: Онбординг пройдено успішно (роль є в базі)
  // Не пускаємо назад на лендинг або анкету онбордингу
  if (currentPath === "/" //|| currentPath === "/onboarding"
  )
  {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url); // Тільки на твій готовий Дашборд
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
