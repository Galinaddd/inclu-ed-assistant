"use server";

import { createServerConnection } from "../utils/supabase/server"; // Серверний коннекшн Supabase

interface OnboardingData {
  userId: string;
  role: "teacher" | "parent";
  childName: string; // 🌟 ДОДАЛИ СЮДИ: ім'я дитини з форми
  childProfile: string;
  supportLevel: number;
  childAge: number | null;
  schoolClass: number;
  programId: string | null;
}

export async function submitOnboardingAction(data: OnboardingData) {
  const supabase = await createServerConnection(); // Використовуємо серверний коннекшн Supabase

  try {
    if (!data.userId || !data.role || !data.childProfile) {
      return {
        success: false,
        error: "Будь ласка, заповніть усі обовʼязкові поля.",
      };
    }

    // 1. Оновлюємо роль користувача в таблиці profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: data.role,
        ai_credits_left: 5,
      })
      .eq("id", data.userId);

    if (profileError) throw profileError;

    // 2. Записуємо картку дитини в таблицю children_profiles
    const { error: childError } = await supabase
      .from("children_profiles")
      .insert({
        user_id: data.userId,
        child_name: data.childName, // 🌟 ТЕПЕР ЗАПИСУЄМО РЕАЛЬНЕ ІМ'Я З ФОРМИ В БАЗУ!
        child_profile: data.childProfile,
        support_level: data.supportLevel,
        child_age: data.childAge,
        school_class: data.schoolClass,
        program_id: data.programId,
      });

    if (childError) throw childError;

    // 3. Створюємо запис у журналі credit_transactions_log
    await supabase.from("credit_transactions_log").insert({
      user_id: data.userId,
      amount: 5,
      balance_after: 5,
      reason: "INITIAL_BONUS",
      description:
        "Нарахування 5 безкоштовних кредитів за успішне налаштування профілю",
    });

    return { success: true };
  } catch (err: any) {
    console.error("Помилка сервера при онбордингу:", err);
    return {
      success: false,
      error: err.message || "Внутрішня помилка сервера.",
    };
  }
}
