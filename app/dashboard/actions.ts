"use server";

import { createServerConnection } from "../utils/supabase/server";
import { uploadTextToR2, downloadTextFromR2 } from "../utils/r2/r2-helpers";
import { generateSourceKey, generateAdaptedKey } from "../utils/r2/naming";
import { runTextAdaptationPipeline } from "../utils/ai/adaptation-service";
import {
  executeBookRegistrationPipeline,
  BookData,
} from "../utils/supabase/books";

interface AdaptTextParams {
  text: string;
  userId: string;
  userRole: "teacher" | "family";
  subjectName: string;
  contentType: "text" | "attachment" | "test";
  clientChildData: {
    // ✨ Додаємо жорстку типізацію під наш швидкий флоу
    id: string;
    child_name: string;
    school_class: number;
    support_level: number;
    child_age: number;
    diagnosis_code: string;
    diagnosis_title: string;
  };
}

// ✨ Жорстка типізація повернення екшену для лікування фронтенду без костилів
export type CheckBookResponse =
  | { success: true; isDuplicate: boolean; data: BookData }
  | { success: false; error: string; data?: never; isDuplicate?: never };

/**
 * Крок 1: Строгий реляційний запит предметів програми
 */
export async function getSubjectsByChild(
  schoolClass: number,
  programId: string | null,
) {
  try {
    if (!programId) return { success: true, data: [] };
    const supabase = await createServerConnection();
    const { data, error } = await supabase
      .from("program_subjects")
      .select("id, subject_name, program_id, school_class")
      .eq("school_class", schoolClass)
      .eq("program_id", programId)
      .order("subject_name", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Помилка в getSubjectsByChild:", error.message);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Крок 2: Строгий реляційний запит підручників
 */
export async function getBooksBySubject(
  subjectId: string,
  schoolClass: number,
) {
  try {
    const supabase = await createServerConnection();
    const { data, error } = await supabase
      .from("books")
      .select("id, title, publisher, publishing_year")
      .eq("subject_id", subjectId)
      .eq("school_class", schoolClass)
      .order("title", { ascending: true });

    if (error) throw error;
    return { success: true, data: (data as BookData[]) || [] };
  } catch (error: any) {
    console.error("Помилка in getBooksBySubject:", error.message);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * ✨ Крок 4: Запит параграфів підручника з динамічним зчитуванням тексту з R2
 * Витягує дерево змісту з Supabase, а сам важкий контент параграфа підтягує прямо з Cloudflare R2.
 * Повністю безкоштовно для бази даних, без ШІ та без ризику роздуття дискового простору.
 */
export async function getParagraphsByBook(bookId: string) {
  try {
    const supabase = await createServerConnection();

    // 1. Перевіряємо, чи є у цієї книги батьківський лінк-вказівник (Глобальна дедуплікація НУШ)
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, parent_book_id")
      .eq("id", bookId)
      .single();

    if (bookError) throw bookError;

    // 2. Якщо parent_book_id існує, беремо контент оригінальної книги-першоджерела, інакше — поточної
    const targetBookId = book.parent_book_id || book.id;

    // 3. Стягуємо метадані змісту підручника з Supabase
    const { data: paragraphs, error: contentError } = await supabase
      .from("book_contents")
      .select("id, chapter_title, paragraph_number, raw_text")
      .eq("book_id", targetBookId)
      .order("paragraph_number", { ascending: true });

    if (contentError) throw contentError;
    if (!paragraphs || paragraphs.length === 0)
      return { success: true, data: [] };

    // 4. КАНОНІЧНИЙ ПАЙПЛАЙН: Паралельно перетворюємо R2-покажчики на живий Markdown-контент
    const paragraphsWithLiveText = await Promise.all(
      paragraphs.map(async (p) => {
        try {
          // Перевіряємо, чи в полі raw_text дійсно лежить шлях до нашої теки R2 content.md
          if (
            p.raw_text &&
            (p.raw_text.startsWith("source-books") ||
              p.raw_text.includes(".md"))
          ) {
            // Викликаємо ваш низькорівневий хелпер для стягування чистого файлу
            const liveMarkdown = await downloadTextFromR2(p.raw_text);

            return {
              id: p.id,
              chapter_title: p.chapter_title,
              paragraph_number: p.paragraph_number,
              raw_text: liveMarkdown, // На фронтенд повертається повноцінний текст із LaTeX та "Зверни увагу!"
            };
          }

          // Ретро-сумісність: якщо там раптом лежить старий сирий текст
          return p;
        } catch (r2Error) {
          console.error(
            `[R2 Error] Не вдалося зчитати файл для параграфа ${p.paragraph_number}:`,
            r2Error,
          );
          return {
            id: p.id,
            chapter_title: p.chapter_title,
            paragraph_number: p.paragraph_number,
            raw_text: `⚠️ Не вдалося завантажити контент параграфа зі сховища R2.`,
          };
        }
      }),
    );

    return { success: true, data: paragraphsWithLiveText };
  } catch (error: any) {
    console.error("Помилка в getParagraphsByBook:", error.message);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Крок 3: Тонка декларативна обгортка дедуплікації підручників
 */
// 📂 Заміни застарілу функцію в app/dashboard/actions.ts на цей вичищений контур:

/**
 * ✨ Крок 3: Вичищена декларативна обгортка реєстрації
 * (Операція перенесена на асинхронні роути продакшену, залишено сумісність інтрефейсів)
 */
export async function checkAndRegisterBook(params: {
  fileHash: string;
  subjectId: string;
  schoolClass: number;
  programId: string | null;
  fileName: string;
  rawMarkdown: string; // ✨ Замінено застарілий fileBase64 на чистий готовий текст
}): Promise<CheckBookResponse> {
  try {
    const { createServerConnection } = await import("../utils/supabase/server");
    const { executeBookRegistrationPipeline } =
      await import("../utils/supabase/books");

    const supabase = await createServerConnection();
    const result = await executeBookRegistrationPipeline(supabase, params);
    return { success: true, ...result };
  } catch (error: any) {
    console.error("Помилка в checkAndRegisterBook:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ОПЕРАЦІЯ 5: ТОНКИЙ ДЕКЛАРАТИВНИЙ ЕКШЕН АДАПТАЦІЇ ТЕКСТУ
 */
export async function adaptMaterialAction(params: AdaptTextParams) {
  try {
    const supabase = await createServerConnection();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || params.userId;

    // Перевірка кредитів на балансі профілю користувача
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ai_credits_left")
      .eq("id", currentUserId)
      .single();

    if (profileError) throw profileError;
    if (!profile || profile.ai_credits_left <= 0) {
      throw new Error(
        "Недостатньо кредитів для генерації. Будь ласка, оновіть баланс.",
      );
    }

    // Виклик декомпонованого ШІ-пайплайну, куди летять готові клієнтські дані
    const { aiText, autoTitle, r2Key } = await runTextAdaptationPipeline({
      userId: currentUserId,
      text: params.text,
      userRole: params.userRole,
      subjectName: params.subjectName,
      contentType: params.contentType,
      clientChildData: params.clientChildData,
    });

    // Завантажуємо результат адаптації в Cloudflare R2
    await uploadTextToR2(r2Key, aiText);

    // Записуємо факт адаптації в історію
    const { error: dbError } = await supabase
      .from("history_adaptations")
      .insert({
        user_id: currentUserId,
        child_id: params.clientChildData.id,
        book_id: null,
        paragraph_number: null,
        title: autoTitle,
        r2_path: r2Key,
      });

    if (dbError) throw dbError;

    // Списуємо 1 ШІ-кредит за успішну генерацію
    await supabase
      .from("profiles")
      .update({ ai_credits_left: profile.ai_credits_left - 1 })
      .eq("id", currentUserId);

    return { success: true, data: aiText };
  } catch (error: any) {
    console.error("Помилка в adaptMaterialAction:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ОПЕРАЦІЯ 6: СТВОРЕННЯ КАРТКИ ДИТИНИ (АНТИ-ФРОД ОБМЕЖЕННЯ)
 */
export async function createChildProfileAction(childData: {
  childName: string;
  childProfile: string;
  supportLevel: number;
  childAge: number;
  schoolClass: number;
  programId: string | null;
}) {
  try {
    const supabase = await createServerConnection();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("Користувач не авторизований.");

    const { count, error: countError } = await supabase
      .from("children_profiles")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id);

    if (countError) throw countError;
    if (count !== null && count >= 3) {
      throw new Error("Досягнуто ліміт карток дітей (макс. 3).");
    }

    const { data: newChild, error: insertError } = await supabase
      .from("children_profiles")
      .insert({
        user_id: session.user.id,
        child_name: childData.childName,
        child_profile: childData.childProfile,
        support_level: childData.supportLevel,
        child_age: childData.childAge,
        school_class: childData.schoolClass,
        program_id: childData.programId,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return { success: true, data: newChild };
  } catch (error: any) {
    console.error("Помилка in createChildProfileAction:", error.message);
    return { success: false, error: error.message };
  }
}

export async function saveSourceParagraph(params: any) {
  try {
    const supabase = await createServerConnection();
    const r2Key = generateSourceKey(params);
    await uploadTextToR2(r2Key, params.contentMarkdown);
    const { data } = await supabase
      .from("book_contents")
      .insert({
        book_id: params.bookId,
        chapter_title: params.chapterTitle,
        paragraph_number: params.paragraphNumber,
        raw_text: r2Key,
      })
      .select()
      .single();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSourceParagraphContent(r2Key: string) {
  try {
    return { success: true, data: await downloadTextFromR2(r2Key) };
  } catch (error: any) {
    return { success: false, error: error.message, data: "" };
  }
}

export async function saveAdaptedMaterial(params: any) {
  try {
    const supabase = await createServerConnection();
    const r2Key = generateAdaptedKey(params);
    await uploadTextToR2(r2Key, params.adaptedContent);
    const { data } = await supabase
      .from("generated_materials")
      .insert({
        user_id: params.userId,
        child_id: params.childId,
        book_id: params.bookId,
        paragraph_number: params.paragraphNumber,
        subject_id: params.subjectId,
        category: params.category,
        topic_title: params.topicTitle,
        target_diagnosis: params.targetDiagnosis,
        target_support_level: params.targetSupportLevel,
        target_school_class: params.targetSchoolClass,
        target_child_age: params.targetChildAge,
        target_program_id: params.targetProgramId,
        content_markdown: r2Key,
      })
      .select()
      .single();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAdaptedMaterialContent(r2Key: string) {
  try {
    return { success: true, data: await downloadTextFromR2(r2Key) };
  } catch (error: any) {
    return { success: false, error: error.message, data: "" };
  }
}
