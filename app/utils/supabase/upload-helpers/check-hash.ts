// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/check-hash.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { BookData } from "./types";

/**
 * 🔍 КРОК 1: ПОЄДНАНА АДМІН-ДЕДУПЛІКАЦІЯ ПРОГРАМИ (Bypass RLS)
 * Перевіряє тільки наявність хешу. Захищає від duplicate key для books_file_hash_key.
 */
export async function checkFileHashOnly(
  supabase: SupabaseClient,
  params: {
    fileHash: string;
    subjectId: string;
    schoolClass: number;
    programId: string | null;
  },
): Promise<{ isDuplicate: boolean; data: BookData | null }> {
  console.log(
    `⏳ [МОДУЛЬ ЗАВАНТАЖЕННЯ] Перевірка дедуплікації хешу: ${params.fileHash}`,
  );

  const { data: existingBooks, error: searchError } = await supabase
    .from("books")
    .select(
      "id, title, publisher, publishing_year, parent_book_id, program_id, subject_id",
    )
    .eq("file_hash", params.fileHash);

  if (searchError) throw searchError;

  if (!existingBooks || existingBooks.length === 0) {
    return { isDuplicate: false, data: null };
  }

  const exactMatchInProgram = existingBooks.find(
    (book) => book.program_id === params.programId,
  );
  if (exactMatchInProgram) {
    return { isDuplicate: true, data: exactMatchInProgram as BookData };
  }

  console.log(
    "🔗 Книга знайдена в іншій програмі. Реєстрація лінку через parent_book_id...",
  );
  const firstBook = existingBooks[0];
  const trueParentId = firstBook.parent_book_id || firstBook.id;

  const { data: clonedBook, error: cloneError } = await supabase
    .from("books")
    .insert({
      title: firstBook.title,
      publisher: firstBook.publisher,
      publishing_year: firstBook.publishing_year,
      subject_id: params.subjectId,
      school_class: params.schoolClass,
      program_id: params.programId,
      file_hash: params.fileHash,
      parent_book_id: trueParentId,
    })
    .select(
      "id, title, publisher, publishing_year, school_class, program_id, subject_id, parent_book_id",
    )
    .single();

  if (cloneError) throw cloneError;
  return { isDuplicate: true, data: clonedBook as BookData };
}
