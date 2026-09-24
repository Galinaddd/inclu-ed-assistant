// 📂 Шлях до файлу: utils/ai/structuring-service.ts
import OpenAI from "openai";

export interface StructuredBookResult {
  title: string;
  publisher: string;
  publishing_year: number;
  detected_subject: string; // Потрібні для валідації в books.ts
  detected_class: number; // Потрібні для валідації в books.ts
  chapters: { title: string; paragraphs: string[] }[];
}

export async function runBookStructuringPipeline(
  extractedMarkdown: string,
  expectedClass: number,
  expectedSubjectName: string,
): Promise<StructuredBookResult> {
  console.log(
    "⏳ [КРОК 4] Ініціалізація структурування JSON через OpenAI GPT-4o...",
  );

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const safeTextSample = extractedMarkdown.substring(0, 45000);

    const structuringResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ти — системний девелопер та архітектор даних. Твоє завдання — структурувати розпізнаний текст підручника у валідний JSON-об'єкт.
ОБОВ'ЯЗКОВО уважно проаналізуй перші сторінки контенту підручника та чітко визнач назву предмету українською мовою одним-двома словами (наприклад: Математика, Українська мова, Я досліджую світ) та для якого це класу (суворо цифрою від 1 до 11).

Формат відповіді СУВОРO за цією схемою:
{
  "title": "Офіційна назва підручника",
  "publisher": "Назва видавництва або Глобальний каталог IncluEd",
  "publishing_year": 2024,
  "detected_subject": "Назва предмету", // Визначений предмет одним-двома словами українською
  "detected_class": 1, // Визначений клас суворо як ЧИСЛО
  "chapters": [
    {
      "title": "Повна назва глави або розділу підручника",
      "paragraphs": ["1.1", "1.2", "1.3"]
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Ось розпізнаний текст книги: \n\n${safeTextSample}`,
        },
      ],
      temperature: 0.1,
    });

    console.log("✅ [КРОК 4] OpenAI успішно сформував відповідь.");

    // Наша залізобетонна типізація choices без багів синтаксису
    const finalJsonString =
      structuringResponse.choices?.[0]?.message?.content || "{}";

    console.log("=======================================================");
    console.log("🎯 [ФІНАЛЬНИЙ РЕЗУЛЬТАТ ШІ] Структура під базу даних:");
    console.log(finalJsonString);
    console.log("=======================================================");

    const aiResult = JSON.parse(finalJsonString);

    // ==========================================
    // 🛡️ КРОС-ФІЛЬТР ВІД ТРЕШУ ТА ПОМИЛОК КОРИСТУВАЧА
    // ==========================================
    if (
      aiResult.detected_class &&
      Number(aiResult.detected_class) !== expectedClass
    ) {
      throw new Error(
        `Клас підручника не збігається! Ви додаєте книгу у кабінет ${expectedClass}-го класу, але ШІ визначив цей файл як підручник для ${aiResult.detected_class}-го класу.`,
      );
    }

    const chosenSubj = expectedSubjectName.toLowerCase().trim();
    const aiSubj = String(aiResult.detected_subject || "")
      .toLowerCase()
      .trim();
    if (!aiSubj.includes(chosenSubj) && !chosenSubj.includes(aiSubj)) {
      throw new Error(
        `Предмет підручника не збігається! Ви обрали категорію "${expectedSubjectName}", але завантажений файл розпізнано як підручник з предмету "${aiResult.detected_subject}".`,
      );
    }

    return aiResult as StructuredBookResult;
  } catch (error: any) {
    console.error("\n❌❌❌ КРИТИЧНИЙ ЗБІЙ НА ЕТАПІ OpenAI СТРУКТУРУВАННЯ:");
    console.error(`Повідомлення про помилку: ${error.message}`);
    console.log("=======================================================\n");
    throw error;
  }
}
