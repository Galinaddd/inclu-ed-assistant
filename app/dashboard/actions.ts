"use server";

import { createServerConnection } from "../utils/supabase/server";
import { uploadTextToR2, downloadTextFromR2 } from "../utils/r2/r2-helpers";
import { generateSourceKey, generateAdaptedKey } from "../utils/r2/naming";
import { parseNewBookWithAI } from "../utils/r2/parser-helper";
import { runTextAdaptationPipeline } from "../utils/ai/adaptation-service"; // Наш декомпонований ШІ-пайплайн

export interface BookData {
  id: string;
  title: string;
  publishing_year: number | null;
  publisher: string | null;
  school_class: number;
  program_id: string | null;
  subject_id: string | null;
  file_hash: string | null;
}

interface AdaptTextParams {
  text: string;
  childId: string;
  userRole: "teacher" | "family";
  subjectName: string;
}

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
    console.error("Помилка в екшені getSubjectsByChild:", error.message);
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
    console.error("Помилка в екшені getBooksBySubject:", error.message);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * ОПЕРАЦІЯ 1: ЗАПИС ПОЧАТКОВОГО МАТЕРІАЛУ (Оригінальний параграф книги)
 */
export async function saveSourceParagraph(params: {
  programId: string;
  schoolClass: number;
  subjectId: string;
  author: string;
  year: number;
  bookId: string;
  paragraphNumber: string;
  chapterTitle: string;
  contentMarkdown: string;
}) {
  try {
    const supabase = await createServerConnection();
    const r2Key = generateSourceKey(params);

    await uploadTextToR2(r2Key, params.contentMarkdown);

    const { data, error } = await supabase
      .from("book_contents")
      .insert({
        book_id: params.bookId,
        chapter_title: params.chapterTitle,
        paragraph_number: params.paragraphNumber,
        raw_text: r2Key,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Помилка при збереженні параграфа:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ОПЕРАЦІЯ 2: ЧИТАННЯ ПОЧАТКОВОГО МАТЕРІАЛУ
 */
export async function getSourceParagraphContent(r2Key: string) {
  try {
    const text = await downloadTextFromR2(r2Key);
    return { success: true, data: text };
  } catch (error: any) {
    console.error("Помилка читання з Cloudflare R2:", error.message);
    return { success: false, error: error.message, data: "" };
  }
}
/**
 * ОПЕРАЦІЯ 3: ЗАПИС АДАПТОВАНОГО МАТЕРІАЛУ (Глобальний архів)
 */
export async function saveAdaptedMaterial(params: {
  userId: string;
  childId: string;
  bookId: string | null;
  paragraphNumber: string;
  subjectId: string;
  category: string;
  topicTitle: string;
  targetDiagnosis: string;
  targetSupportLevel: number;
  targetSchoolClass: number;
  targetChildAge: number;
  targetProgramId: string | null;
  author: string;
  year: number;
  adaptedContent: string;
  programSlug: string;
}) {
  try {
    const supabase = await createServerConnection();
    const r2Key = generateAdaptedKey(params);

    await uploadTextToR2(r2Key, params.adaptedContent);

    const { data, error } = await supabase
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

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Помилка saveAdaptedMaterial:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ОПЕРАЦІЯ 4: ЧИТАННЯ АДАПТОВАНОГО МАТЕРІАЛУ
 */
export async function getAdaptedMaterialContent(r2Key: string) {
  try {
    const text = await downloadTextFromR2(r2Key);
    return { success: true, data: text };
  } catch (error: any) {
    console.error("Помилка getAdaptedMaterialContent:", error.message);
    return { success: false, error: error.message, data: "" };
  }
}

/**
 * Крок 3: Всеукраїнська дедуплікація та ліниве створення глобальної книги за SHA-256
 */
export async function checkAndRegisterBook({
  fileHash,
  subjectId,
  schoolClass,
  programId,
  fileName,
  fileBase64,
}: {
  fileHash: string;
  subjectId: string;
  schoolClass: number;
  programId: string | null;
  fileName: string;
  fileBase64: string;
}) {
  try {
    const supabase = await createServerConnection();

    // 1. Шукаємо книгу у ВСІЙ базі за унікальним відбитком (Глобальний пошук)
    const { data: existingBook, error: searchError } = await supabase
      .from("books")
      .select("id, title, publisher, publishing_year")
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (searchError) throw searchError;

    // СЦЕНАРІЙ А: Книгу вже оцифровано кимось в Україні. Повертаємо її моментально!
    if (existingBook) {
      return {
        success: true,
        isDuplicate: true,
        data: existingBook as BookData,
      };
    }

    // СЦЕНАРІЙ Б: Книга абсолютно нова для системи. Запускаємо лінивий ШІ-парсинг.
    const aiParsedResult = await parseNewBookWithAI(fileHash, fileBase64);

    // Зберігаємо запис у глобальну таблицю книг з прив'язкою до поточної сітки
    const { data: newBook, error: insertError } = await supabase
      .from("books")
      .insert({
        title:
          aiParsedResult.title !== "Підручник адаптовано нейромережею"
            ? aiParsedResult.title
            : fileName.replace(".pdf", ""),
        publisher: aiParsedResult.publisher,
        publishing_year: aiParsedResult.publishing_year,
        subject_id: subjectId,
        school_class: schoolClass,
        program_id: programId,
        file_hash: fileHash,
      })
      .select("id, title, publisher, publishing_year")
      .single();

    if (insertError) throw insertError;

    return {
      success: true,
      isDuplicate: false,
      data: newBook as BookData,
    };
  } catch (error: any) {
    console.error("Помилка в екшені checkAndRegisterBook:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ОПЕРАЦІЯ 5: ТОНКИЙ ДЕКЛАРАТИВНИЙ ЕКШЕН АДАПТАЦІЇ ТЕКСТУ (Шлях Мами / Конспекти Вчителя)
 * Результат пишеться у хмару R2 через утиліту, а посилання фіксується в історії.
 */
export async function adaptMaterialAction(params: AdaptTextParams) {
  try {
    const supabase = await createServerConnection();

    // 1. Отримуємо user_id з поточної активної сесії Supabase
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id || "anonymous_user_id";

    // 2. Передаємо роботу нашому ізольованому утилітарному ШІ-пайплайну
    const { aiText, autoTitle, r2Key } = await runTextAdaptationPipeline({
      userId,
      text: params.text,
      childId: params.childId,
      userRole: params.userRole,
      subjectName: params.subjectName,
    });

    // 3. БОЙОВИЙ ЗАПИС ТЕКСТУ В CLOUDFLARE R2 за допомогою вашої рідної функції
    await uploadTextToR2(r2Key, aiText);

    // 4. ЗАПИС МЕТАДАНИХ В УНІВЕРСАЛЬНУ ТАБЛИЦЮ ІСТОРІЇ (Supabase)
    const { error: dbError } = await supabase
      .from("history_adaptations")
      .insert({
        user_id: userId,
        child_id: params.childId || null,
        book_id: null, // Суворо NULL — тригер для нічного pg_cron чищення особистих архівів!
        paragraph_number: null,
        title: autoTitle,
        r2_path: r2Key, //-- Зберігаємо посилання на файл у хмарі R2
      });

    if (dbError) throw dbError;

    return { success: true, data: aiText };
  } catch (error: any) {
    console.error(
      "Помилка в декларативному екшені adaptMaterialAction:",
      error.message,
    );
    return { success: false, error: error.message };
  }
}
