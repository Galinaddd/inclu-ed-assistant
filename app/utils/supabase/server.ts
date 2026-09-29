import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 🔒 СТАНДАРТНИЙ КЛІЄНТ (З урахуванням RLS авторизації вчителя)
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
              cookieStore.set(name, value, options),
            );
          } catch {
            // Очікувано для Server Components
          }
        },
      },
    },
  );
}

/**
 * 🔑 АДМІНІСТРАТИВНИЙ КЛІЄНТ (ДЛЯ ОБХОДУ RLS У ФОНОВИХ ТАСКАХ)
 * Використовує суворий Service Role Key. Ніколи не падає через політики безпеки рядків!
 */
export async function createAdminServerConnection() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // 🔥 Потужний секретний ключ бекенду
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
            // Очікувано для Server Components
          }
        },
      },
    },
  );
}
