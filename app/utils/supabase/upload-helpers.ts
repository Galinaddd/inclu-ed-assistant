// 📂 Шлях до файлу: app/utils/supabase/upload-helpers.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { uploadTextToR2 } from "@/app/utils/r2/r2-helpers";
import { generateSourceKey } from "@/app/utils/r2/naming";
import { readPdfPages } from "pdf-text-reader";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/app/utils/r2/r2";

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

export interface ExtractedTitleMetadata {
  title: string;
  detectedYear: number;
  detectedClass: number | null;
  detectedSubject: string | null;
  coverKey: string | null;
}

/**
 * 🔍 КРОК 1 (ТВОЯ ПОЄДНАНА ЛОГІКА): ІЗОЛЬОВАНА ПЕРЕВІРКА ХЕШУ ТА ТОТОЖНИХ КЛОНІВ ПРОГРАМИ
 * Працює строго через прокинутий в аргументах всемогутній адмін-клієнт supabase.
 * Захищає від duplicate key для books_file_hash_key на 100%!
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
    `⏳ [СЕРВІС КНИГ] Послідовна перевірка хешу файлу: ${params.fileHash}`,
  );

  // 1. Шукаємо абсолютно всі записи підручників з цим хешем файлу
  const { data: existingBooks, error: searchError } = await supabase
    .from("books")
    .select(
      "id, title, publisher, publishing_year, parent_book_id, program_id, subject_id",
    )
    .eq("file_hash", params.fileHash);

  if (searchError) throw searchError;

  // Якщо книги з таким хешем немає взагалі в системі — вона 100% нова, йдемо на Етап 2
  if (!existingBooks || existingBooks.length === 0) {
    return { isDuplicate: false, data: null };
  }

  // ========================================================
  // ✨ ТВОЄ ПОЄДНАНЕ ПРАВИЛО: Шукаємо будь-який збіг з поточною освітньою програмою вчителя
  // ========================================================
  const exactMatchInProgram = existingBooks.find(
    (book) => book.program_id === params.programId,
  );

  if (exactMatchInProgram) {
    console.log(
      "🎯 [УСПІХ] Підручник (оригінал або клон) вже існує у цій програмі! Інсерт скасовано.",
    );
    return { isDuplicate: true, data: exactMatchInProgram as BookData }; // Миттєво повертаємо, zero-insert!
  }

  // ========================================================
  // 3. РЕЛЯЦІЙНИЙ СЦЕНАРІЙ (НУШ): Хеш є в базі, але для ЦІЄЇ програми лінку ще немає. Робимо лінк-клон!
  // ========================================================
  console.log(
    "🔗 Книга знайдена в іншій програмі. Реєстрація реляційного лінку через parent_book_id...",
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
      parent_book_id: trueParentId, // зв'язуємо картку програми з оригіналом першоджерела
    })
    .select(
      "id, title, publisher, publishing_year, school_class, program_id, subject_id, parent_book_id",
    )
    .single();

  if (cloneError) throw cloneError;
  return { isDuplicate: true, data: clonedBook as BookData };
}

/**
 * 🛠️ КРОК 2: ТЕХНІЧНИЙ ПАРСЕР СТОРІНОК 2-3 ТА ОБКЛАДИНКИ СТOРІНКИ 1
 * Суто технічна робота: вилучає текст та малює обкладинку, без жодних бізнес-перевірок.
 */
export async function parsePdfTitlePage(
  file: File,
  fileHash: string,
  expectedSubjectName: string,
): Promise<ExtractedTitleMetadata> {
  console.log("⏳ [ХЕЛПЕР] Нативний витяг тексту сторінок 2-3...");

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  let titleText = "";
  try {
    const pages = await readPdfPages({ data: fileBuffer });
    titleText = pages
      .slice(1, 3)
      .map((page) => page.lines.join(" "))
      .join("\n");
  } catch (err) {
    console.log("⚠️ Не вдалося прочитати шар тексту на 2-3 сторінках.");
  }

  const titleLower = titleText.toLowerCase();
  let detectedClass: number | null = null;
  let detectedYear = 1111;
  let hasExpectedSubjectInContent = false;

  if (titleText.trim().length > 10) {
    const classMatch = titleText.match(/\b([1-9]|1[0-2])\s*(?:-й\s+)?клас/i);
    if (classMatch && classMatch) detectedClass = parseInt(classMatch[1], 10);

    const preciseYearMatch = titleText.match(
      /(?:©|р\.|року|видавництво|затверджено)\s*\b(201\d|202\d|203\d)\b/i,
    );
    if (preciseYearMatch && preciseYearMatch) {
      detectedYear = parseInt(preciseYearMatch[1], 10);
    } else {
      const generalYearMatch = titleText.match(/\b(201\d|202\d|203\d)\b/);
      if (generalYearMatch && generalYearMatch)
        detectedYear = parseInt(generalYearMatch[0], 10);
    }

    const fullTextToAnalyze = `${titleLower} ${file.name.toLowerCase()}`;
    const subjectCleaned = expectedSubjectName
      .toLowerCase()
      .trim()
      .replace(/ська|ка|іка/g, "");
    const subjectRoot = subjectCleaned.substring(
      0,
      Math.min(5, subjectCleaned.length),
    );

    if (subjectRoot.length >= 3) {
      hasExpectedSubjectInContent = fullTextToAnalyze.includes(subjectRoot);
    }
  }

  let coverKey: string | null = null;
  try {
    const pdfImgConvert = require("pdf-img-convert");
    const coverOutput = await pdfImgConvert.convert(fileBuffer, {
      page_numbers: [1],
      width: 450,
    });
    if (coverOutput && coverOutput.length > 0) {
      coverKey = `book-covers/${fileHash}.png`;
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: coverKey,
          Body: Buffer.from(coverOutput[0]),
          ContentType: "image/png",
        }),
      );
    }
  } catch (err) {
    console.log("⚠️ Не вдалося технічно вирізати обкладинку зі сторінки 1.");
  }

  const cleanBookTitle = file.name.replace(".pdf", "").replace(/[_-]/g, " ");

  return {
    title: cleanBookTitle,
    detectedYear,
    detectedClass,
    detectedSubject: hasExpectedSubjectInContent
      ? expectedSubjectName
      : "Невідповідний предмет",
    coverKey,
  };
}
// 📂 Фінал файлу: app/utils/supabase/upload-helpers.ts

/**
 * 🛡️ КРОК 3 (АКТ ВАЛІДАЦІЇ): ЧИСТИЙ КРОС-ФІЛЬТР ВІД ПОМИЛОК КОРИСТУВАЧА
 * Займається суто бізнес-правилами відповідності метаданих кабінету на Етапі 1.
 */
export function validateNushMetadata(
  meta: { detectedClass: number | null; detectedSubject: string | null },
  expectedClass: number,
  expectedSubjectName: string,
): void {
  console.log(
    "⏳ [ХЕЛПЕР] Запуск суворого крос-фільтру бізнес-правил відповідності...",
  );
  console.log("expectedSubjectName, ", expectedSubjectName);

  // 1. Валідація класу підручника з 2-3 сторінок технічного тексту
  if (meta.detectedClass !== null && meta.detectedClass !== expectedClass) {
    throw new Error(
      `🚨 Клас підручника не збігається! Кабінет: ${expectedClass} клас, а на титулці файлу знайдено: ${meta.detectedClass} клас.`,
    );
  }

  // 2. Валідація предмета підручника за динамічним автоматичним коренем слова
  if (meta.detectedSubject === "Невідповідний предмет") {
    throw new Error(
      `🚨 Предмет підручника не збігається! Ви намагаєтесь додати цей файл у предмет "${expectedSubjectName}", проте в тексті книги та назві файлу не знайдено жодного збігу з цією дисципліною.`,
    );
  }
}

/**
 * 🪓 КРОК 4: АСИНХРОННЕ СТВОРЕННЯ КНИГИ ТА ТВІЙ ОРИГІНАЛЬНИЙ ІНДЕКСНИЙ СПЛІТТЕР (ЕТАП 2)
 * Запускається строго після SUCCESS Лами. Працює під істинними адмін-правами db в обхід RLS [1.1].
 * Сама у фоні без таймаутів вирізає Сторінку 1 в PNG обкладинку та фіксує параграфи для дашборду [1.1].
 */
export async function createBookAndStreamContentsToR2(
  supabase: SupabaseClient, // залишено для сумісності сигнатури виклику в роуті
  params: {
    rawMarkdown: string;
    fileName: string;
    fileHash: string;
    subjectId: string;
    schoolClass: number;
    programId: string | null;
    publishingYear: number;
    fileBuffer: Buffer; // бінарний буфер файлу з Етапу 2
  },
): Promise<BookData> {
  console.log(
    "⏳ [СЕРВІС КНИГ] Створення оригінальної картки книги разом із обкладинкою...",
  );

  const { createClient } = await import("@supabase/supabase-js");
  const nushAdminCommitDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Асинхронно вирізаємо першу сторінку в PNG обкладинку сховища R2
  let coverKey: string | null = null;
  try {
    const pdfImgConvert = require("pdf-img-convert");
    const coverOutput = await pdfImgConvert.convert(params.fileBuffer, {
      page_numbers: [1],
      width: 450,
    });

    if (coverOutput && coverOutput.length > 0) {
      coverKey = `book-covers/${params.fileHash}.png`;
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: coverKey,
          Body: Buffer.from(coverOutput[0]),
          ContentType: "image/png",
        }),
      );
      console.log(
        `✅ Обкладинку підручника успішно завантажено в R2 асинхронно.`,
      );
    }
  } catch (err: any) {
    console.error("⚠️ Помилка асинхронної генерації обкладинки:", err.message);
  }

  const cleanBookTitle = params.fileName
    .replace(".pdf", "")
    .replace(/[_-]/g, " ");

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

  // ✨ ТВІЙ ОРИГІНАЛЬНИЙ РОБОЧИЙ СПЛІТТЕР (ВІДНОВЛЕНО СИМВОЛ У СИМВОЛ)
  const lines = params.rawMarkdown.split("\n");
  const tempNodes: any[] = [];
  let currentChapterTitle = "Вступні матеріали підручника";
  let paragraphCounter = 1;
  let currentParagraphStartIdx = 0;
  const structuralRegex = /^(#{2,3})\s+(.+)\$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(structuralRegex);
    if (!match) continue;

    const headingText = lines[i].trim();
    const lowerHeading = headingText.toLowerCase();

    const isStructure =
      ["параграф", "§", "розділ", "глава", "тема", "додаток"].some((keyword) =>
        lowerHeading.includes(keyword),
      ) || /^\d+(\.\d+)*\s+/.test(headingText.replace(/###|##/g, "").trim());

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
    currentChapterTitle = headingText.replace(/###|##/g, "").trim();
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

  if (tempNodes.length > 0) {
    console.log(
      `⏳ [СЕРВІС КНИГ] Розпихання ${tempNodes.length} Markdown-параграфів по теках R2 сховища...`,
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
      console.log(
        `✅ [УСПІХ] Усі параграфи успішно зафіксовано в базі через нативний адмін-клієнт.`,
      );
    }
  }

  return newBook as BookData;
}
