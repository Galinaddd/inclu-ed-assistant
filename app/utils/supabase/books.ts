// 📂 Шлях до файлу: app/utils/supabase/books.ts
import { SupabaseClient } from "@supabase/supabase-js";

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
 * Глобальна дедуплікація підручників НУШ через parent_book_id без OpenAI.
 * ✨ ОЧИЩЕНО ВІД ЛАМИ: Тепер приймає вже готовий rawMarkdown через аргументи!
 */
export async function executeBookRegistrationPipeline(
  supabase: SupabaseClient,
  params: {
    fileHash: string;
    subjectId: string;
    schoolClass: number;
    programId: string | null;
    fileName: string;
    rawMarkdown: string; // ✨ Текст передається як готовий аргумент з асинхронного роуту
  },
) {
  // 1. Пошук існуючої книги за хешем та обробка сценаріїв дуплікації [1.1]
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
    const trueParentId =
      globalExistingBook.parent_book_id || globalExistingBook.id;

    const { data: exactSubjectClone, error: cloneCheckError } = await supabase
      .from("books")
      .select(
        "id, title, publisher, publishing_year, program_id, subject_id, parent_book_id",
      )
      .eq("file_hash", params.fileHash)
      .eq("program_id", params.programId)
      .eq("subject_id", params.subjectId)
      .maybeSingle();

    if (cloneCheckError) throw cloneCheckError;
    if (exactSubjectClone) {
      return { isDuplicate: true, data: exactSubjectClone as BookData };
    }

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
        parent_book_id: trueParentId,
      })
      .select(
        "id, title, publisher, publishing_year, program_id, subject_id, parent_book_id",
      )
      .single();

    if (cloneError) throw cloneError;
    return { isDuplicate: true, data: clonedBook as BookData };
  }

  // 2. Обробка нової книги — Ламу звідси ПОВНІСТЮ СТЕРТО. Працюємо з готовим текстом.
  const cleanBookTitle = params.fileName
    .replace(/\.[^/.]+\$/, "")
    .replace(/[_-]/g, " ");

  let detectedYear = new Date().getFullYear();
  const yearMatch = params.rawMarkdown
    .substring(0, 4000)
    .match(/\b(201\d|202\d|203\d)\b/);
  if (yearMatch) {
    detectedYear = parseInt(yearMatch[0], 10);
  }

  // Створюємо головну картку оригінальної книги в базі даних Supabase
  const { data: newBook, error: insertError } = await supabase
    .from("books")
    .insert({
      title: cleanBookTitle,
      publisher: "Видавництво НУШ",
      publishing_year: detectedYear,
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

  // 3. НАДІЖНИЙ ОРИГІНАЛЬНИЙ СПЛІТТЕР ПАРАГРАФІВ (Працює за 0 грн)
  const lines = params.rawMarkdown.split("\n");
  const tempNodes: any[] = [];

  let currentChapterTitle = "Вступні матеріали підручника";
  let paragraphCounter = 1;
  let currentParagraphStartIdx = 0;

  const structuralRegex = /^(#{2,3})\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(structuralRegex);
    if (!match) continue;

    const headingText = match[0].trim();
    const lowerHeading = headingText.toLowerCase();

    const isStructure =
      ["параграф", "§", "розділ", "глава", "тема", "додаток"].some((keyword) =>
        lowerHeading.includes(keyword),
      ) || /^\d+(\.\d+)*\s+/.test(headingText);

    if (!isStructure) continue;

    const charEndIdx = params.rawMarkdown.indexOf(lines[i]);

    if (charEndIdx > currentParagraphStartIdx + 10) {
      const formattedNum = String(paragraphCounter).padStart(3, "0");
      tempNodes.push({
        chapter_title: currentChapterTitle,
        paragraph_number: formattedNum,
        start: currentParagraphStartIdx,
        end: charEndIdx,
      });
      paragraphCounter++;
    }

    currentChapterTitle = headingText;
    currentParagraphStartIdx = charEndIdx;
  }

  if (params.rawMarkdown.length > currentParagraphStartIdx + 10) {
    const formattedNum = String(paragraphCounter).padStart(3, "0");
    tempNodes.push({
      chapter_title: currentChapterTitle,
      paragraph_number: formattedNum,
      start: currentParagraphStartIdx,
      end: params.rawMarkdown.length,
    });
  }

  // 4. ЗАВАНТАЖЕННЯ КОНТЕНТУ В CLOUDFLARE R2 ТА СИНХРОНІЗАЦІЯ З SUPABASE
  const contentRows: any[] = [];
  const { r2Client, R2_BUCKET_NAME } = await import("@/app/utils/r2/r2");
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { generateSourceKey } = await import("@/app/utils/r2/naming");

  for (const node of tempNodes) {
    const paragraphMarkdownContent = params.rawMarkdown
      .substring(node.start, node.end)
      .trim();

    const r2Key = generateSourceKey({
      programId: params.programId || "unknown_program",
      schoolClass: params.schoolClass,
      subjectId: params.subjectId,
      author: "pidruchnyk",
      year: detectedYear,
      paragraphNumber: node.paragraph_number,
    });

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: paragraphMarkdownContent,
        ContentType: "text/markdown; charset=utf-8",
      }),
    );

    contentRows.push({
      book_id: newBook.id,
      chapter_title: node.chapter_title,
      paragraph_number: node.paragraph_number,
      raw_text: r2Key,
    });
  }

  if (contentRows.length > 0) {
    const { error: paragraphsInsertError } = await supabase
      .from("book_contents")
      .insert(contentRows);

    if (paragraphsInsertError) {
      console.error(
        "⚠️ Помилка автоматичного збереження дерева параграфів:",
        paragraphsInsertError.message,
      );
    }
  }

  return { isDuplicate: false, data: newBook as BookData };
}
