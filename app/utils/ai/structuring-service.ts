export interface StructuredBookResult {
  title: string;
  publisher: string;
  publishing_year: number; // 🔥 СУВОРЕ ЧИСЛО! Жодних null чи undefined
  detected_subject: string;
  detected_class: number;
  chapters: { title: string; paragraphs: string[] }[];
}

/**
 * ⚡ БЕЗКОШТОВНИЙ ПАЙПЛАЙН СТРУКТУРУВАННЯ ТА КРОС-ВАЛІДАЦІЇ (БЕЗ ШІ)
 */
export async function runBookStructuringPipeline(
  extractedMarkdown: string,
  expectedClass: number,
  expectedSubjectName: string,
): Promise<StructuredBookResult> {
  console.log(
    "⏳ [КРОК 2] Запуск контуру точної валідації метаданих без ШІ...",
  );

  try {
    const safeTextSample = extractedMarkdown.substring(0, 45000);
    const sampleLower = safeTextSample.toLowerCase();

    // 1. Пошук класу (наприклад, "3 клас")
    let detectedClass = expectedClass;
    const classMatch = safeTextSample.match(
      /\b([1-9]|1[0-2])\s*(?:-й\s+)?клас/i,
    );
    if (classMatch) {
      detectedClass = parseInt(classMatch[10], 10);
    }

    // 2. 🛡️ ЗАЛІЗНИЙ ВИЛОВ РОКУ З ЗАГЛУШКОЮ 1111
    let detectedYear = 1111; // 💡 Ваша заглушка за дефолтом!
    const preciseYearMatch = safeTextSample.match(
      /(?:©|р\.|року|видавництво|затверджено)\s*\b(201\d|202\d|203\d)\b/i,
    );

    if (preciseYearMatch && preciseYearMatch[1]) {
      detectedYear = parseInt(preciseYearMatch[1], 10);
    } else {
      const generalYearMatch = safeTextSample.match(/\b(201\d|202\d|203\d)\b/);
      if (generalYearMatch && generalYearMatch[0]) {
        detectedYear = parseInt(generalYearMatch[0], 10);
      }
    }

    // 3. Авто-визначення реального предмету підручника
    let detectedSubject = expectedSubjectName;
    const popularSubjects = [
      "математика",
      "українська мова",
      "я досліджую світ",
      "біологія",
      "географія",
      "історія",
      "фізика",
      "хімія",
      "інформатика",
    ];
    for (const subj of popularSubjects) {
      if (sampleLower.includes(subj)) {
        detectedSubject = subj.charAt(0).toUpperCase() + subj.slice(1);
        break;
      }
    }

    const mockStructuredResult: StructuredBookResult = {
      title: "Підручник НУШ",
      publisher: "Оригінальне видання",
      publishing_year: detectedYear, // Передається залізобетонний number (або реальний рік, або 1111)
      detected_subject: detectedSubject,
      detected_class: detectedClass,
      chapters: [],
    };

    // 🛡️ КРОС-ФІЛЬТР ВІД ПОМИЛОК КОРИСТУВАЧА
    if (mockStructuredResult.detected_class !== expectedClass) {
      throw new Error(
        `Клас підручника не збігається! Ви додаєте книгу у кабінет ${expectedClass}-го класу, але система визначила цей файл як підручник для ${mockStructuredResult.detected_class}-го класу.`,
      );
    }

    const chosenSubj = expectedSubjectName.toLowerCase().trim();
    const aiSubj = mockStructuredResult.detected_subject.toLowerCase().trim();

    if (!aiSubj.includes(chosenSubj) && !chosenSubj.includes(aiSubj)) {
      throw new Error(
        `Предмет підручника не збігається! Ви обрали категорію "${expectedSubjectName}", але завантажений файл розпізнано як підручник з предмету "${mockStructuredResult.detected_subject}".`,
      );
    }

    return mockStructuredResult;
  } catch (error: any) {
    console.error(
      "\n❌❌❌ КРИТИЧНИЙ ЗБІЙ НА ЕТАПІ БЕЗКОШТОВНОЇ ВАЛІДАЦІЇ КНИГИ:",
      error.message,
    );
    throw error;
  }
}
