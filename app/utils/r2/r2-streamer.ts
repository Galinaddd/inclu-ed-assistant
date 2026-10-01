// 📂 Шлях до файлу: app/utils/r2/r2-streamer.ts
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { uploadTextToR2, uploadBufferToR2 } from "./r2-helpers";
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
}

/**
 * 🪓 КРОК 4: АДМІН-СТВОРЕННЯ КНИГИ ТА СТРІМІНГ Markdown В R2 (Bypass RLS)
 * Логіка нарізки контенту повністю відокремлена від низькорівневих S3-команд.
 * ✨ ВИПРАВЛЕНО: Регулярку очищено від шкідливих символів, заголовки чисті для дашборду!
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
    fileBuffer: Buffer;
  },
): Promise<BookData> {
  console.log(
    "⏳ [R2 СТРІМЕР] Запуск асинхронного процесу створення книги та нарізки контенту...",
  );

  const nushAdminCommitDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. АСИНХРОННЕ ВИРІЗАННЯ ОБКЛАДИНКИ: Вирізаємо Сторінку 1 строго у масив
  let coverKey: string | null = null;
  try {
    const pdfImgConvert = require("pdf-img-convert");
    const coverOutput = await pdfImgConvert.convert(params.fileBuffer, {
      page_numbers: [1],
      width: 450,
    });

    if (coverOutput && coverOutput.length > 0) {
      coverKey = `book-covers/${params.fileHash}.png`;
      await uploadBufferToR2(coverKey, Buffer.from(coverOutput), "image/png");
      console.log(`✅ Обкладинку підручника успішно відправлено в R2.`);
    }
  } catch (err: any) {
    console.error("⚠️ Помилка асинхронної генерації обкладинки:", err.message);
  }

  // Розумне зрізання розширення файлу
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
      cover_url: coverKey,
    })
    .select(
      "id, title, publisher, publishing_year, school_class, program_id, subject_id, cover_url",
    )
    .single();

  if (insertError) throw insertError;

  // 3. ТВІЙ ОРИГІНАЛЬНИЙ РОБОЧИЙ СПЛІТТЕР (Очищений від багів та регулярних зсувів)
  const lines = params.rawMarkdown.split("\n");
  const tempNodes: any[] = [];
  let currentChapterTitle = "Вступні матеріали підручника";
  let paragraphCounter = 1;
  let currentParagraphStartIdx = 0;

  // ✨ ВИПРАВЛЕНО: Прибрали шкідливий знак долара наприкінці регулярки!
  const structuralRegex = /^(#{2,3})\s+(.+)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(structuralRegex);
    if (!match) continue;

    // ✨ ВИПРАВЛЕНО ts(2339): беремо чистий текст рядка з lines[i]
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
        chapter_title: currentChapterTitle, // Зберігаємо чистий текст заголовка для компонента дашборду
        paragraph_number: String(paragraphCounter).padStart(3, "0"),
        start: currentParagraphStartIdx,
        end: charEndIdx,
      });
      paragraphCounter++;
    }
    currentChapterTitle = cleanHeadingText; // Оновлюємо назву глави БЕЗ решіток для наступного кроку
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

  return newBook as BookData;
}
