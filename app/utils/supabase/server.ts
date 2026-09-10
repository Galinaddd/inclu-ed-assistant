import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Створює з'єднання (коннекшн) з базою Supabase для СЕРВЕРА
 */
export async function createServerConnection() {
  const cookieStore = await cookies();

  return createServerClient(
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
              cookieStore.set({ name, value, ...options }),
            );
          } catch (error) {
            // Заглушка для безпечної роботи в middleware
          }
        },
      },
    },
  );
}
