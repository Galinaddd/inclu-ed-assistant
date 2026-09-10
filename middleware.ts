import { NextResponse, type NextRequest } from "next/server";
import { createServerConnection } from "@/app/utils/supabase/server"; // Наш чистий серверний коннекшн

console.log("middleware is working");

export async function middleware(request: NextRequest) {
  // 1. Активуємо підключення до бази на сервері в один рядок
  const supabase = await createServerConnection();

  // 2. Запитуємо у Supabase, чи є активна сесія користувача
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentPath = request.nextUrl.pathname;

  // 3. ГОЛОВНИЙ ЗАХИСТ: Якщо користувач НЕ увійшов (user === null)
  // і намагається зайти на БУДЬ-ЯКИЙ маршрут, окрім посадкового кореня "/"
  if (!user && currentPath !== "/") {
    // Силоміць розвертаємо його і перенаправляємо на головну сторінку
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Якщо користувач авторизований або він іде на головну — пускаємо далі
  return NextResponse.next();
}

// 4. КОНФІГУРАЦІЯ МАРШРУТІВ
// Цей конфіг каже Next.js перехоплювати абсолютно всі сторінки на сайті,
// але повністю ігнорувати статичні картинки, стилі, шрифти та іконки, щоб сайт не ламався візуально.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
