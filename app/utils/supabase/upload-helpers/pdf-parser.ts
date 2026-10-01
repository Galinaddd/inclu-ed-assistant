// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/pdf-parser.ts
import { readPdfPages } from "pdf-text-reader";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/app/utils/r2/r2";
import { ExtractedTitleMetadata } from "./types";
import { parseMetadataFromFilename } from "./filename-parser"; // ✨ Викликаємо нашу нову функцію!

/**
 * 🛠️ КРОК 2: АКТ ТЕХНІЧНОГО ВИЛУЧЕННЯ МЕТАДАНИХ ТА ГЕНЕРАЦІЇ ОБКЛАДИНКИ
 * Охоплює 5 сторінок підручника. Якщо текст порожній — викликає окрему функцію аналізу назви!
 */
export async function parsePdfTitlePage(
  file: File,
  fileHash: string,
  expectedSubjectName: string,
): Promise<ExtractedTitleMetadata> {
  console.log(
    "⏳ [МОДУЛЬ ЗАВАНТАЖЕННЯ] Нативний витяг тексту 5 сторінок підручника...",
  );

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  let titleText = "";
  try {
    const pages = await readPdfPages({ data: fileBuffer });
    titleText = pages
      .slice(1, 5)
      .map((page) => page.lines.join(" "))
      .join("\n");
  } catch (err) {
    console.log("⚠️ Не вдалося прочитати шар тексту на 2-5 сторінках.");
  }

  const titleLower = titleText.toLowerCase();

  let detectedClass: number | null = null;
  let detectedYear = 1111;
  let hasExpectedSubjectInContent = false;

  // Спочатку пробуємо знайти дані у тексті сторінок
  if (titleText.trim().length > 10) {
    const classMatch = titleText.match(/\b([1-9]|1[0-2])\s*клас/i);
    if (classMatch && classMatch[1])
      detectedClass = parseInt(classMatch[1], 10);

    const preciseYearMatch = titleText.match(
      /(?:©|р\.|року|видавництво|затверджено)\s*\b(201\d|202\d|203\d)\b/i,
    );
    if (preciseYearMatch && preciseYearMatch[1])
      detectedYear = parseInt(preciseYearMatch[1], 10);
  }

  // ✨ ПІДСТРАХОВКА: Якщо текст порожній або регулярка схибила — викликаємо нашу окрему функцію назви файлу!
  if (!detectedClass || detectedYear === 1111) {
    const filenameMeta = parseMetadataFromFilename(
      file.name,
      expectedSubjectName,
    );
    if (!detectedClass) detectedClass = filenameMeta.detectedClass;
    if (detectedYear === 1111) detectedYear = filenameMeta.detectedYear;
    hasExpectedSubjectInContent = filenameMeta.hasSubjectMatch;
  } else {
    // Якщо текст усередині PDF був, робимо звичайну перевірку предмета по тексту
    const chosenSubjectLower = expectedSubjectName.toLowerCase().trim();
    const subjectKeywords: Record<string, string[]> = {
      "українська мова": ["українськ", "укр", "мова", "буквар", "читан"],
      "українська література": ["література", "літ", "lit"],
      математика: ["матем", "мат", "math"],
    };
    const keywords = subjectKeywords[chosenSubjectLower] || [
      chosenSubjectLower.substring(0, 4),
    ];
    hasExpectedSubjectInContent = keywords.some((keyword) =>
      titleLower.includes(keyword),
    );
  }

  // Захист від іноземців та укрліт для української мови
  if (
    expectedSubjectName.toLowerCase().trim() === "українська мова" &&
    (file.name.toLowerCase().includes("english") ||
      file.name.toLowerCase().includes("література"))
  ) {
    hasExpectedSubjectInContent = false;
  }

  // Асинхронний експорт обкладинки сторінки 1 в PNG
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
    console.log("⚠️ Обкладинка сторінки 1 не згенерована (Node Canvas).");
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
