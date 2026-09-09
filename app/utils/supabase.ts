import { createBrowserClient } from "@supabase/ssr";

// Ця функція бере ключі з .env.local та запускає зв'язок із базою (Тільки клієнт)
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
