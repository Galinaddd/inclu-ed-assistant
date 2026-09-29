// 📂 Шлях до файлу: app/utils/r2/parser-helper.ts
import { parseTextWithLlama } from "./llama-parser";

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
 * 🧠 ОРКЕСТРАТОР ОЦИФРУВАННЯ ТА СТРУКТУРУВАННЯ ПІДРУЧНИКІВ
 * Підтримує як пряме оцифрування, так і роботу з уже готовим текстом на Етапі 2.
 */
export async function parseNewBookWithAI(
  fileHash: string,
  fileBase64: string,
  fileName: string = "book.pdf",
  alreadyExtractedMarkdown?: string, // ✨ Опціональний готовий текст для Етапу 2
): Promise<ParsedBookResult> {
  console.log("\n=======================================================");
  console.log("🚀 [ЯДРО] ЗАПУСК ОПТИМІЗОВАНОГО ОРКЕСТРАТОРА ПАРСИНГУ");
  console.log("=======================================================");

  try {
    // 1. Визначаємо джерело тексту: або беремо готовий з Етапу 2, або смикаємо Ламу заново
    let extractedMarkdown = "";

    if (alreadyExtractedMarkdown) {
      console.log(
        "ℹ️ [ЯДРО] Текст уже отримано від Лами на попередньому кроці. Пропускаємо запит.",
      );
      extractedMarkdown = alreadyExtractedMarkdown;
    } else if (fileBase64) {
      console.log(
        "⏳ [ЯДРО] Пряме оцифрування великого файлу через LlamaParse...",
      );
      extractedMarkdown = await parseTextWithLlama(fileBase64, fileName);
    }

    if (!extractedMarkdown || extractedMarkdown.trim().length < 10) {
      throw new Error(
        "Отримано порожній або занадто короткий контент тексту підручника.",
      );
    }

    // 2. БЕЗКОШТОВНИЙ КОДОВИЙ СПЛІТТЕР ПАРАГРАФІВ
    const lines = extractedMarkdown.split("\n");
    const generatedChapters: ChapterData[] = [];

    let paragraphCounter = 1;
    const structuralRegex = /^(#{2,3})\s+(.+)\$/;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(structuralRegex);
      if (!match) continue;

      const headingText = lines[i].replace(/###|##/g, "").trim();
      const lowerHeading = headingText.toLowerCase();

      const isStructure =
        [
          "параграф",
          "§",
          "розділ",
          "глава",
          "тема",
          "урок",
          "unit",
          "lesson",
        ].some((keyword) => lowerHeading.includes(keyword)) ||
        /^\d+(\.\d+)*\s+/.test(headingText) ||
        lines[i].startsWith("###");

      if (isStructure) {
        const formattedNum = String(paragraphCounter).padStart(3, "0");
        generatedChapters.push({
          title: headingText,
          paragraph_number: formattedNum,
          paragraphs: [formattedNum],
        });
        paragraphCounter++;
      }
    }

    if (generatedChapters.length === 0) {
      console.log(
        "ℹ️ [ЯДРО] Структурних тегів не виявлено. Аварійна подушка безпеки на 20 тем...",
      );
      for (let i = 1; i <= 20; i++) {
        const formattedNum = String(i).padStart(3, "0");
        generatedChapters.push({
          title: `Частина ${i} • Матеріали оцифрування уроку`,
          paragraph_number: formattedNum,
          paragraphs: [formattedNum],
        });
      }
    }

    // 3. Виявлення року видання підручника
    let detectedYear = new Date().getFullYear();
    const yearMatch = extractedMarkdown
      .substring(0, 4000)
      .match(/\b(201\d|202\d|203\d)\b/);
    if (yearMatch) {
      detectedYear = parseInt(yearMatch[0], 10);
    }

    console.log(
      `✅ [ЯДРО] Збирання змісту завершено. Виділено тем: ${generatedChapters.length}`,
    );

    return {
      title: "Оригінальне видання НУШ",
      publisher: "Видавництво НУШ",
      publishing_year: detectedYear,
      chapters: generatedChapters,
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
