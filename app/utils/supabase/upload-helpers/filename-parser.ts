/**
 * 🛠️ ЧИСТА ФУНКЦІЯ: Автономний аналіз імені файлу
 * Шукає маркери і повертає значення або null, якщо збігів немає.
 */
export function parseMetadataFromFilename(fileName: string) {
  const nameLower = fileName.toLowerCase().replace(/[_-]/g, " ");

  let detectedClass: number | null = null;
  let detectedYear: number | null = null;
  let detectedSubject: string | null = null;

  // 1. Пошук класу в назві (наприклад, "1 клас", "6-клас", "11klas")
  const classMatch =
    nameLower.match(/\b([1-9]|1[0-2])[- ]*клас/i) ||
    nameLower.match(/\b([1-9]|1[0-2])[- ]*klas/i) ||
    nameLower.match(/\b([1-9]|1[0-2])[- ]*кл\b/i);

  if (classMatch && classMatch[1]) {
    detectedClass = parseInt(classMatch[1], 10);
  }

  // 2. Пошук чотирьох цифр року видання (наприклад, "2025", "2024")
  const yearMatch = nameLower.match(/\b(201\d|202\d|203\d)\b/);
  if (yearMatch && yearMatch[1]) {
    detectedYear = parseInt(yearMatch[1], 10);
  }

  // 3. Зіставлення предмета за ключовими словами
  const subjectKeywords: Record<string, string[]> = {
    "Українська мова": [
      "українськ",
      "укр",
      "мова",
      "буквар",
      "читан",
      "mova",
      "ukr",
    ],
    "Українська література": [
      "література",
      "літ",
      "lit",
      "literatura",
      "ukrlit",
    ],
    Математика: ["матем", "мат", "math", "matematika"],
    "Я досліджую світ": ["світ", "дослідж", "ядо", "jds", "yds"],
    "Англійська мова": ["англійськ", "англ", "english", "eng"],
  };

  for (const [subjectName, keywords] of Object.entries(subjectKeywords)) {
    if (keywords.some((keyword) => nameLower.includes(keyword))) {
      detectedSubject = subjectName;
      break;
    }
  }

  // Повертаємо чисті значення або null. Якщо файл називався "1.pdf",
  // то detectedClass буде 1, а subject буде null, і сервер з цим легко розбереться.
  return { detectedClass, detectedYear, detectedSubject };
}
