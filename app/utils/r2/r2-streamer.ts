import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { uploadTextToR2 } from "./r2-helpers";
import { generateSourceKey } from "./naming";

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
  cover_url?: string | null;
  file_path?: string | null;
}

/**
 * 🪓 КРОК 4: АДМІН-СТВОРЕННЯ КНИГИ ТА СТРІМІНГ Markdown В R2 (Bypass RLS)
 */
export async function createBookAndStreamContentsToR2(
  supabase: SupabaseClient,
  params: {
    rawMarkdown: string;
    fileName: string;
    fileHash: string;
    subjectId: string;
    schoolClass: number;
    programId: string | null;
    publishingYear: number;
    fileKey: string;
    llamaCoverUrl?: string | null;
  },
): Promise<BookData> {
  console.log(
    "⏳ [R2 СТРІМЕР] Запуск асинхронного процесу створення книги та нарізки контенту...",
  );

  // 🌟 ПОВЕРНУЛИ ОГОЛОШЕННЯ КЛІЄНТА БД
  const nushAdminCommitDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 🌟 ПОВЕРНУЛИ ОГОЛОШЕННЯ ОБКЛАДИНКИ
  const finalCoverUrl =
    params.llamaCoverUrl || "/images/default-book-cover.png";
  console.log(`📡 Використовуємо обкладинку книги: ${finalCoverUrl}`);

  // 🌟 ПОВЕРНУЛИ ОГОЛОШЕННЯ НАЗВИ
  const cleanBookTitle = params.fileName
    .replace(/\.[^/.]+\$/, "")
    .replace(/[_-]/g, " ");

  // 2. Створюємо картку оригінальної книги в базі Supabase
  const { data: newBook, error: insertError } = await nushAdminCommitDb
    .from("books")
    .insert({
      title: cleanBookTitle,
      publisher: "Видавництво НУШ",
      publishing_year: params.publishingYear,
      subject_id: params.subjectId,
      school_class: params.schoolClass,
      program_id: params.programId,
      file_hash: params.fileHash,
      parent_book_id: null,
      cover_url: finalCoverUrl,
      file_path: params.fileKey,
    })
    .select(
      "id, title, publisher, publishing_year, school_class, program_id, subject_id, cover_url, file_path",
    )
    .single();

  if (insertError) throw insertError;

  // 3. ТВІЙ ОРИГІНАЛЬНИЙ РОБОЧИЙ СПЛІТТЕР (Повністю збережений)
  const lines = params.rawMarkdown.split("\n");
  const tempNodes: any[] = [];
  let currentChapterTitle = "Вступні матеріали підручника";
  let paragraphCounter = 1;
  let currentParagraphStartIdx = 0;

  const structuralRegex = /^(#{2,3})\s+(.+)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(structuralRegex);
    if (!match) continue;

    const headingLine = lines[i].trim();
    const cleanHeadingText = headingLine.replace(/###|##/g, "").trim();
    const lowerHeading = cleanHeadingText.toLowerCase();

    const isStructure =
      ["параграф", "§", "розділ", "глава", "тема", "додаток"].some((keyword) =>
        lowerHeading.includes(keyword),
      ) || /^\d+(\.\d+)*\s+/.test(cleanHeadingText);

    if (!isStructure) continue;

    const charEndIdx = params.rawMarkdown.indexOf(lines[i]);
    if (charEndIdx > currentParagraphStartIdx + 10) {
      tempNodes.push({
        chapter_title: currentChapterTitle,
        paragraph_number: String(paragraphCounter).padStart(3, "0"),
        start: currentParagraphStartIdx,
        end: charEndIdx,
      });
      paragraphCounter++;
    }
    currentChapterTitle = cleanHeadingText;
    currentParagraphStartIdx = charEndIdx;
  }

  if (params.rawMarkdown.length > currentParagraphStartIdx + 10) {
    tempNodes.push({
      chapter_title: currentChapterTitle,
      paragraph_number: String(paragraphCounter).padStart(3, "0"),
      start: currentParagraphStartIdx,
      end: params.rawMarkdown.length,
    });
  }

  // 4. Стрімінг параграфів у хмару Cloudflare R2
  if (tempNodes.length > 0) {
    console.log(
      `⏳ [R2 СТРІМЕР] Нарізка та відправка ${tempNodes.length} оригінальних параграфів...`,
    );
    const contentRows = await Promise.all(
      tempNodes.map(async (node) => {
        const realParagraphText = params.rawMarkdown
          .substring(node.start, node.end)
          .trim();
        const r2Key = generateSourceKey({
          programId: params.programId || "unknown_program",
          schoolClass: params.schoolClass,
          subjectId: params.subjectId,
          author: "pidruchnyk",
          year: params.publishingYear,
          paragraphNumber: node.paragraph_number,
        });

        await uploadTextToR2(r2Key, realParagraphText);

        return {
          book_id: newBook.id,
          chapter_title: node.chapter_title,
          paragraph_number: node.paragraph_number,
          raw_text: r2Key,
        };
      }),
    );

    if (contentRows.length > 0) {
      const { error: contentsError } = await nushAdminCommitDb
        .from("book_contents")
        .insert(contentRows);
      if (contentsError) throw contentsError;
      console.log(`✅ [УСПІХ] Усі параграфи успішно зафіксовано в R2 та базі.`);
    }
  }

  return {
    id: newBook.id,
    title: newBook.title,
    publisher: newBook.publisher,
    publishing_year: newBook.publishing_year,
    school_class: newBook.school_class,
    program_id: newBook.program_id,
    subject_id: newBook.subject_id,
    file_hash: params.fileHash,
    cover_url: newBook.cover_url,
    file_path: newBook.file_path,
  } as BookData;
}
