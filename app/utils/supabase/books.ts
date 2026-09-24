import { SupabaseClient } from "@supabase/supabase-js";
import { parseTextWithLlama } from "../r2/llama-parser"; // Очищений технічний рукав
import { runBookStructuringPipeline } from "../ai/structuring-service"; // Новий ШІ-сервіс валідації
import { generateSourceKey } from "../r2/naming";

export interface BookData {
  id: string;
  title: string;
  publishing_year: number | null;
  publisher: string | null;
  school_class: number;
  program_id: string | null;
  subject_id: string | null;
  file_hash: string | null;
  parent_book_id?: string | null;
}

/**
 * 🏛️ ЧИСТА СЕРВЕРНА ЛОГІКА БАЗИ ДАНИХ (Supabase-сервіс)
 * Крос-програмна та крос-предметна дедуплікація підручників через механізм parent_book_id
 * із вбудованим автоматичним ШІ-фільтром крос-валідації предмета і класу (Захист від сміття).
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
  // 1. Шукаємо першоджерельну книгу за хешем у всій системі (Глобальний пошук по Україні)
  // Сортування за created_at гарантує, що ми завжди візьмемо саму першу (оригінальну) книгу
  const { data: globalExistingBook, error: searchError } = await supabase
    .from("books")
    .select(
      "id, title, publisher, publishing_year, program_id, subject_id, parent_book_id",
    )
    .eq("file_hash", params.fileHash)
    .order("created_at", { ascending: true })
    .range(0, 0)
    .maybeSingle();

  if (searchError) throw searchError;

  if (globalExistingBook) {
    // Визначаємо справжній root-ID оригінальної книги (якщо знайдена книга сама є клоном)
    const trueParentId =
      globalExistingBook.parent_book_id || globalExistingBook.id;

    // ✨ СЦЕНАРІЙ А: Перевіряємо, чи ця книга ВЖЕ була прив'язана до цього конкретного предмета і програми раніше
    const { data: exactSubjectClone, error: cloneCheckError } = await supabase
      .from("books")
      .select(
        "id, title, publisher, publishing_year, program_id, subject_id, parent_book_id",
      )
      .eq("file_hash", params.fileHash)
      .eq("program_id", params.programId)
      .eq("subject_id", params.subjectId) // Строга ізоляція в межах предметної сітки дашборду
      .maybeSingle();

    if (cloneCheckError) throw cloneCheckError;

    // Якщо точний збіг по предмету та програмі знайдено — миттєво повертаємо його без створення нових рядків
    if (exactSubjectClone) {
      return { isDuplicate: true, data: exactSubjectClone as BookData };
    }

    // ✨ СЦЕНАРІЙ Б: Книга є в системі, але завантажується для ІНШОЇ програми або для ІНШОГО предмета!
    // Створюємо новий легкий рядок-вказівник у таблиці `books` (Дедуплікація програм НУШ)
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
        parent_book_id: trueParentId, // 🔗 Пряме лінкування на оригінал з контентом
      })
      .select(
        "id, title, publisher, publishing_year, program_id, subject_id, parent_book_id",
      )
      .single();

    if (cloneError) throw cloneError;

    // 🛑 ТАБЛИЦЮ book_contents БІЛЬШЕ НЕ ЧІПАЄМО — ЖОДНОГО ДУБЛЮВАННЯ РЯДКІВ КОНТЕНТУ!

    return { isDuplicate: true, data: clonedBook as BookData };
  }

  // ✨ СЦЕНАРІЙ В: Книга абсолютно нова для всієї платформи. Запускаємо декомпозирований конвеєр.

  // Крок А: Викликаємо вистраданий технічний рукав Лами для отримання сухого тексту книги
  const rawMarkdown = await parseTextWithLlama(
    params.fileBase64,
    params.fileName,
  );

  // Отримуємо реальну назву предмета з бази даних для перехресної ШІ-перевірки
  const { data: currentSubject } = await supabase
    .from("program_subjects")
    .select("subject_name")
    .eq("id", params.subjectId)
    .single();
  const expectedSubjectName =
    currentSubject?.subject_name || "Невідомий предмет";

  // Крок Б: Передаємо Markdown в ШІ-структуризатор для збирання глав та залізного захисту від сміття
  const aiParsedResult = await runBookStructuringPipeline(
    rawMarkdown,
    params.schoolClass,
    expectedSubjectName,
  );

  // Крок В: Створюємо головну оригінальну картку книги (вона стає першоджерелом, parent_book_id = null)
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
      parent_book_id: null,
    })
    .select(
      "id, title, publisher, publishing_year, program_id, subject_id, parent_book_id",
    )
    .single();

  if (insertError) throw insertError;

  // Крок Г: Записуємо параграфи оригінальної книги в єдиному екземплярі
  if (aiParsedResult.chapters && aiParsedResult.chapters.length > 0) {
    const contentRows: any[] = [];

    aiParsedResult.chapters.forEach((chapter) => {
      if (chapter.paragraphs && chapter.paragraphs.length > 0) {
        chapter.paragraphs.forEach((paragraphNum) => {
          const r2Key = generateSourceKey({
            programId: params.programId || "unknown_program",
            schoolClass: params.schoolClass,
            subjectId: params.subjectId,
            author: aiParsedResult.publisher || "author",
            year: aiParsedResult.publishing_year || new Date().getFullYear(),
            paragraphNumber: paragraphNum,
          });

          contentRows.push({
            book_id: newBook.id, // Пишеться строго під ID оригінальної книги
            chapter_title: chapter.title,
            paragraph_number: paragraphNum,
            raw_text: r2Key,
          });
        });
      }
    });

    if (contentRows.length > 0) {
      const { error: paragraphsInsertError } = await supabase
        .from("book_contents")
        .insert(contentRows);

      if (paragraphsInsertError) {
        console.error(
          "Помилка автоматичного збереження параграфів першоджерела:",
          paragraphsInsertError.message,
        );
      }
    }
  }

  return { isDuplicate: false, data: newBook as BookData };
}
