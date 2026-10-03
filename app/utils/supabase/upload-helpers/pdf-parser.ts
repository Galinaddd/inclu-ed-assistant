import { readPdfPages } from "pdf-text-reader";

// Оновлений чистий інтерфейс, який повертає тільки сирі дані підручника
export interface ExtractedPdfTextMetadata {
  title: string;
  detectedClass: number | null;
  detectedYear: number | null;
  detectedSubject: string | null;
}

/**
 * 🛠️ ЧИСТА ФУНКЦІЯ: Нативний витяг тексту з перших сторінок PDF
 * Досліджує виключно внутрішній вміст документа та повертає знайдені маркери або null.
 */
export async function parsePdfTitlePage(
  file: File,
  fileHash: string, // Залишено для збереження сигнатури виклику, якщо потрібно
): Promise<ExtractedPdfTextMetadata> {
  console.log(
    "⏳ [PDF PARSER] Чистий асинхронний витяг тексту з 5 сторінок прев'ю...",
  );

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  let titleText = "";
  try {
    const pages = await readPdfPages({ data: fileBuffer });
    // Зчитуємо перші 5 сторінок (зріз від 0 до 5)
    titleText = pages
      .slice(0, 5)
      .map((page) => page.lines.join(" "))
      .join("\n");
  } catch (err) {
    console.log("⚠️ Не вдалося прочитати внутрішній шар тексту всередині PDF.");
  }

  const titleLower = titleText.toLowerCase();

  let detectedClass: number | null = null;
  let detectedYear: number | null = null;
  let detectedSubject: string | null = null;

  // Шукаємо маркери в тексті, тільки якщо він реально розпарсився
  if (titleText.trim().length > 10) {
    // 1. Чистий пошук класу в тексті сторінок
    const classMatch = titleText.match(/\b([1-9]|1[0-2])\s*клас/i);
    if (classMatch && classMatch[1]) {
      detectedClass = parseInt(classMatch[1], 10);
    }

    // 2. Чистий пошук року видання в тексті сторінок
    const preciseYearMatch = titleText.match(
      /(?:©|р\.|року|видавництво|затверджено)\s*\b(201\d|202\d|203\d)\b/i,
    );
    if (preciseYearMatch && preciseYearMatch[1]) {
      detectedYear = parseInt(preciseYearMatch[1], 10);
    }

    // 3. 🌟 АВТОНОМНИЙ ПОШУК ПРЕДМЕТА: Перебираємо загальний словник дисциплін НУШ
    const subjectKeywords: Record<string, string[]> = {
      "Українська мова": ["українськ", "мова", "буквар", "читан"],
      "Українська література": ["література", "укрліт"],
      Математика: ["математика", "матем", "геометрія", "алгебра"],
      "Я досліджую світ": ["досліджую світ", "я досліджую"],
      "Англійська мова": ["english", "англійська"],
    };

    for (const [subjectName, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some((keyword) => titleLower.includes(keyword))) {
        detectedSubject = subjectName;
        break;
      }
    }
  }

  // Захист від укрліт або англійської, якщо тексти перемішалися (Твій оригінальний фільтр)
  if (
    detectedSubject === "Українська мова" &&
    (file.name.toLowerCase().includes("english") ||
      file.name.toLowerCase().includes("література"))
  ) {
    detectedSubject = null; // Повертаємо чистий null замість заглушки, даючи шанс назві файлу
  }

  const cleanBookTitle = file.name.replace(".pdf", "").replace(/[_-]/g, " ");

  return {
    title: cleanBookTitle,
    detectedYear,
    detectedClass,
    detectedSubject, // Повертає реальний рядок предмета або null, якщо в тексті порожньо
  };
}
