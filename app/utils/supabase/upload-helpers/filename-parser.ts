// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/filename-parser.ts

/**
 * 🛠️ ОКРЕМА ФУНКЦІЯ: Глибокий аналіз імені файлу (Підстраховка для "німих" PDF)
 * Витягує клас, рік та предмет суто з тексту назви документа.
 */
export function parseMetadataFromFilename(
  fileName: string,
  expectedSubjectName: string,
) {
  const nameLower = fileName.toLowerCase().replace(/[_-]/g, " ");

  let detectedClass: number | null = null;
  let detectedYear = 1111;
  let hasSubjectMatch = false;

  // 1. Пошук класу в імені файлу (наприклад: "1 klas", "6-клас", "11klas")
  const classMatch =
    nameLower.match(/\b([1-9]|1[0-2])\s*клас/i) ||
    nameLower.match(/\b([1-9]|1[0-2])\s*klas/i) ||
    nameLower.match(/\b([1-9]|1[0-2])\s*kl\b/i);
  if (classMatch && classMatch[1]) {
    detectedClass = parseInt(classMatch[1], 10);
  }

  // 2. Пошук чотирьох цифр року видання (наприклад: "2025", "2024")
  const yearMatch = nameLower.match(/\b(201\d|202\d|203\d)\b/);
  if (yearMatch && yearMatch[1]) {
    detectedYear = parseInt(yearMatch[1], 10);
  }

  // 3. Зіставлення предметів з урахуванням латинської транслітерації в імені файлу
  const chosenSubjectLower = expectedSubjectName.toLowerCase().trim();
  const subjectKeywords: Record<string, string[]> = {
    "українська мова": [
      "українськ",
      "укр",
      "мова",
      "буквар",
      "читан",
      "mova",
      "ukr",
    ],
    "українська література": [
      "література",
      "літ",
      "lit",
      "literatura",
      "ukrlit",
    ],
    математика: ["матем", "мат", "math", "matematika"],
    "я досліджую світ": ["світ", "дослідж", "ядо", "jds", "yds"],
    "англійська мова": ["англійськ", "англ", "english", "eng"],
  };

  const keywords = subjectKeywords[chosenSubjectLower] || [
    chosenSubjectLower.substring(0, 4),
  ];
  hasSubjectMatch = keywords.some((keyword) => nameLower.includes(keyword));

  return { detectedClass, detectedYear, hasSubjectMatch };
}
