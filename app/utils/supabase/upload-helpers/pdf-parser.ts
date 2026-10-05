export interface ExtractedPdfTextMetadata {
  title: string;
  detectedClass: number | null;
  detectedYear: number | null;
  detectedSubject: string | null;
}

/**
 * 🛠️ ЧИСТА ФУНКЦІЯ: Нативний витяг тексту з перших сторінок PDF
 */
export async function parsePdfTitlePage(
  file: File,
  fileHash: string,
): Promise<ExtractedPdfTextMetadata> {
  console.log(
    "⏳ [PDF PARSER] Чистий асинхронний витяг тексту з 5 сторінок прев'ю...",
  );

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(new Uint8Array(arrayBuffer));

  let titleText = "";
  try {
    const pdfImport = require("pdf-parse");
    const pdf = typeof pdfImport === "function" ? pdfImport : pdfImport.default;

    if (typeof pdf === "function") {
      // 🌟 Передаємо опцію pagerender, яка повертає пустий рядок для графіки.
      // Це повністю вимикає спроби бібліотеки завантажити важкий "@napi-rs/canvas"
      const parsedData = await (pdf as any)(fileBuffer, {
        pagerender: () => "",
      });

      titleText = parsedData?.text || parsedData?.data?.text || "";

      console.log("=== СИРИЙ ТЕКСТ З PDF ===");
      console.log(titleText.slice(0, 500));
      console.log("=========================");
    }
  } catch (err) {
    console.log(
      "⚠️ Не вдалося прочитати внутрішній шар тексту всередині PDF:",
      err,
    );
  }

  const titleLower = titleText.toLowerCase();

  let detectedClass: number | null = null;
  let detectedYear: number | null = null;
  let detectedSubject: string | null = null;

  // 🌟 КРОК 1: Шукаємо маркери в тексті, тільки якщо він реально розпарсився
  if (titleText.trim().length > 10) {
    // 1. Пошук класу в тексті сторінок
    const classMatch = titleText.match(/\b([1-9]|1[0-2])\s*клас/i);
    if (classMatch && classMatch[1]) {
      detectedClass = parseInt(classMatch[1], 10);
    }

    // 2. 🔥 ОНОВЛЕНИЙ ГНУЧКИЙ ПОШУК РОКУ ВИДАННЯ В ТЕКСТІ
    // Спроба А: Шукаємо суворий збіг із контекстними маркерами (копірайт, видавництво тощо)
    const preciseYearMatch = titleText.match(
      /(?:©|р\.|року|року\b|видавництво|затверджено)\s*\b(201\d|202\d|203\d)\b/i,
    );

    if (preciseYearMatch && preciseYearMatch[1]) {
      detectedYear = parseInt(preciseYearMatch[1], 10);
    } else {
      // Спроба Б (Фолбек): Якщо контексту поруч немає, шукаємо будь-який ізольований рік періоду НУШ (від 2015 до 2027)
      // Допомагає, якщо внизу сторінки написано просто самотнє: "Київ 2024" або "2025"
      const generalYearMatch = titleText.match(/\b(201[5-9]|202[0-7])\b/);
      if (generalYearMatch && generalYearMatch[0]) {
        detectedYear = parseInt(generalYearMatch[0], 10);
      }
    }

    // 3. Перебираємо загальний словник дисциплін НУШ
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

  // 🌟 КРОК 2: ЗАПАСНИЙ ВАРІАНТ (Fallback) — якщо текст пустий, шукаємо в назві файлу
  if (!detectedSubject || !detectedClass || !detectedYear) {
    const fileNameLower = file.name.toLowerCase();

    // Пошук предмета за назвою файлу
    if (!detectedSubject) {
      const fileKeywords: Record<string, string[]> = {
        "Українська мова": [
          "українськ",
          "мова",
          "ukr",
          "mova",
          "буквар",
          "читан",
        ],
        "Українська література": ["література", "укрліт", "lit"],
        Математика: [
          "математика",
          "матем",
          "matem",
          "math",
          "геометрія",
          "алгебра",
        ],
        "Я досліджую світ": ["досліджую світ", "я досліджую", "yds", "ядіс"],
        "Англійська мова": ["english", "англійська", "eng"],
      };

      for (const [subName, keywords] of Object.entries(fileKeywords)) {
        if (keywords.some((keyword) => fileNameLower.includes(keyword))) {
          detectedSubject = subName;
          break;
        }
      }
    }

    // Пошук класу за назвою файлу
    if (!detectedClass) {
      const classMatch = fileNameLower.match(
        /(?:^|[^0-9])([1-9]|1[0-2])(?:\s*(?:клас|klas)|\b)/i,
      );
      if (classMatch && classMatch[1]) {
        detectedClass = parseInt(classMatch[1], 10);
      }
    }

    // 🔥 Пошук року видання за назвою файлу (наприклад, mova-1-klas-2024.pdf)
    if (!detectedYear) {
      const yearMatch = fileNameLower.match(/\b(201[5-9]|202[0-7])\b/);
      if (yearMatch && yearMatch[0]) {
        detectedYear = parseInt(yearMatch[0], 10);
      }
    }
  }

  // 🌟 КРОК 3: ЗАЛІЗОБЕТОННИЙ ДЕФОЛТ ДЛЯ КОРОТКИХ НАЗВ (наприклад, "1.pdf")
  if (!detectedSubject) {
    detectedSubject = "Українська мова";
  }
  if (!detectedClass) {
    detectedClass = 1;
  }
  if (!detectedYear) {
    detectedYear = 2024; // Базовий дефолтний рік для підручників, якщо ніде не знайдено
  }

  // Захист від укрліт або англійської
  if (
    detectedSubject === "Українська мова" &&
    (file.name.toLowerCase().includes("english") ||
      file.name.toLowerCase().includes("література"))
  ) {
    detectedSubject = null;
  }

  const cleanBookTitle = file.name.replace(".pdf", "").replace(/[_-]/g, " ");

  return {
    title: cleanBookTitle,
    detectedYear,
    detectedClass,
    detectedSubject,
  };
}
