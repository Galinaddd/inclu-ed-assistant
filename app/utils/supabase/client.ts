import { createBrowserClient } from "@supabase/ssr";

/**
 * Створює з'єднання (коннекшн) з базою Supabase для БРАУЗЕРА
 */
export const createClientConnection = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
