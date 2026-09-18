"use server";

import { createServerConnection } from "../utils/supabase/server";
import { uploadTextToR2, downloadTextFromR2 } from "../utils/r2/r2-helpers";
import { generateSourceKey, generateAdaptedKey } from "../utils/r2/naming";
// import { SubjectData, BookData } from "../../types"; // Зверніть увагу: файл index підтягнеться сам!

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
