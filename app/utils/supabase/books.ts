import { SupabaseClient } from "@supabase/supabase-js";
import { parseNewBookWithAI } from "../r2/parser-helper";

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
 * 🏛️ ЧИСТА СЕРВЕРНА ЛОГІКА БАЗИ ДАНИХ (Supabase-сервіс)
 * Крос-програмна дедуплікація підручників.
 */
export async function executeBookRegistrationPipeline(
  supabase: SupabaseClient,
  params: {
    fileHash: string;
    subjectId: string;
    schoolClass: number;
    programId: string | null;
    fileName: string;
    fileBase64: string;
  },
) {
  // 1. Шукаємо книгу у ВСІЙ базі за унікальним відбитком (Глобальний пошук по Україні)
  const { data: globalExistingBook, error: searchError } = await supabase
    .from("books")
    .select("id, title, publisher, publishing_year, program_id")
    .eq("file_hash", params.fileHash)
    .maybeSingle();

  if (searchError) throw searchError;

  if (globalExistingBook) {
    // СЦЕНАРІЙ А: Книга вже є в системі й програма НУШ повністю збігається
    if (globalExistingBook.program_id === params.programId) {
      return { isDuplicate: true, data: globalExistingBook as BookData };
    }

    // СЦЕНАРІЙ Б (ВАША ЛОГІКА): Книга є, але для ІНШОГО НУШу!
    // Клонуємо запис у базі для нової програми, перевикористовуючи файли R2
    const { data: clonedBook, error: cloneError } = await supabase
      .from("books")
      .insert({
        title: globalExistingBook.title,
        publisher: globalExistingBook.publisher,
        publishing_year: globalExistingBook.publishing_year,
        subject_id: params.subjectId,
        school_class: params.schoolClass,
        program_id: params.programId,
        file_hash: params.fileHash,
      })
      .select("id, title, publisher, publishing_year")
      .single();

    if (cloneError) throw cloneError;

    // Копіюємо зв'язки розпарсеного контенту у базі Supabase
    const { data: originalContents } = await supabase
      .from("book_contents")
      .select("chapter_title, paragraph_number, raw_text")
      .eq("book_id", globalExistingBook.id);

    if (originalContents && originalContents.length > 0) {
      const insertRows = originalContents.map((row) => ({
        book_id: clonedBook.id,
        chapter_title: row.chapter_title,
        paragraph_number: row.paragraph_number,
        raw_text: row.raw_text,
      }));

      const { error: contentInsertError } = await supabase
        .from("book_contents")
        .insert(insertRows);

      if (contentInsertError) throw contentInsertError;
    }

    return { isDuplicate: true, data: clonedBook as BookData };
  }

  // СЦЕНАРІЙ В: Книга абсолютно нова для всієї платформи. Запускаємо ШІ-заглушку.
  const aiParsedResult = await parseNewBookWithAI(
    params.fileHash,
    params.fileBase64,
  );

  const { data: newBook, error: insertError } = await supabase
    .from("books")
    .insert({
      title:
        aiParsedResult.title !== "Підручник адаптовано нейромережею"
          ? aiParsedResult.title
          : params.fileName.replace(".pdf", ""),
      publisher: aiParsedResult.publisher,
      publishing_year: aiParsedResult.publishing_year,
      subject_id: params.subjectId,
      school_class: params.schoolClass,
      program_id: params.programId,
      file_hash: params.fileHash,
    })
    .select("id, title, publisher, publishing_year")
    .single();

  if (insertError) throw insertError;

  return { isDuplicate: false, data: newBook as BookData };
}
