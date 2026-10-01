// 📂 Шлях до файлу: app/utils/r2/parser-helper.ts

export interface ChapterData {
  title: string;
  paragraph_number: string;
  paragraphs: string[];
}

export interface ParsedBookResult {
  title: string;
  publisher: string | null;
  publishing_year: number | null;
  chapters: ChapterData[];
  fullMarkdown: string;
}

/**
 * 🧠 ОЧИЩЕНИЙ ОРКЕСТРАТОР СТРУКТУРУВАННЯ ПІДРУЧНИКІВ
 * Працює виключно з уже готовим текстом, отриманим від асинхронного роуту статусу.
 * Усі застарілі лінійні виклики та таймаути повністю видалено.
 */
export async function parseNewBookWithAI(
  fileHash: string,
  fileBase64: string, // залишено для сумісності сигнатури
  fileName: string = "book.pdf",
  alreadyExtractedMarkdown?: string,
): Promise<ParsedBookResult> {
  console.log("\n=======================================================");
  console.log("🚀 [ЯДРО] ОБРОБКА ОЦИФРОВАНОГО ТЕКСТУ НА ЕТАПІ 2");
  console.log("=======================================================");

  try {
    const extractedMarkdown = alreadyExtractedMarkdown || "";

    if (!extractedMarkdown || extractedMarkdown.trim().length < 10) {
      throw new Error(
        "Критична помилка: На етап структуризації передано порожній Markdown-текст.",
      );
    }

    // 1. Автоматичне виявлення року видання підручника з перших сторінок контенту
    let detectedYear = new Date().getFullYear();
    const yearMatch = extractedMarkdown
      .substring(0, 4000)
      .match(/\b(201\d|202\d|203\d)\b/);
    if (yearMatch) {
      detectedYear = parseInt(yearMatch[0], 10);
    }

    console.log(
      `✅ [ЯДРО] Аналіз метаданих завершено. Виявлено рік: ${detectedYear}`,
    );

    return {
      title: "Оригінальне видання НУШ",
      publisher: "Видавництво НУШ",
      publishing_year: detectedYear,
      chapters: [], // Саму нарізку контенту тепер залізобетонно робить індексний сплітер у books.ts
      fullMarkdown: extractedMarkdown,
    };
  } catch (error) {
    const err = error as Error;
    console.error(
      "\n❌❌❌ КРИТИЧНИЙ ЗБІЙ В ОРКЕСТРАТОРІ ПАРСИНГУ:",
      err.message,
    );
    throw err;
  }
}
