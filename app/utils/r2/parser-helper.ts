import { OpenAI } from "openai";
import LlamaCloud from "@llamaindex/llama-cloud"; // Наш дефолтний імпорт

interface ParsedBookResult {
  title: string;
  publisher: string;
  publishing_year: number;
  chapters: { title: string; paragraphs: string[] }[];
}

export async function parseNewBookWithAI(
  fileHash: string,
  fileBase64: string,
  fileName: string,
): Promise<ParsedBookResult> {
  console.log("\n=======================================================");
  console.log("🚀 [КРОК 1] ЗАПУСК ОПТИМІЗОВАНОГО КЛІЄНТА LLAMACLOUD v2 API");
  console.log(`Файл: ${fileName}`);
  console.log("=======================================================");

  try {
    // 1. Конвертуємо отриманий Base64 назад у чистий бінарний Buffer Node.js
    const fileBuffer = Buffer.from(fileBase64, "base64");

    // 🌟 ЗА ДОКУМЕНТАЦІЄЮ: Створюємо нативний Node.js об'єкт File, щоб пробити помилку 422!
    // Передаємо масив байтів буфера, ім'я файлу та суворий MIME-тип.
    const binaryFile = new File([fileBuffer], fileName || "book.pdf", {
      type: "application/pdf",
    });

    // 2. Ініціалізуємо офіційний клієнт
    console.log("⏳ [КРОК 2] Ініціалізація LlamaCloud клієнта...");
    const llamaClient = new LlamaCloud({
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    // 📥 ЕТАП 1 ЗА ДОКУМЕНТАЦІЄЮ: Завантажуємо файл у хмару швидким бінарним пакетом
    console.log("⏳ [ETAП 1] Швидке завантаження файлу через files.create...");
    const fileResponse = await llamaClient.files.create({
      file: binaryFile, // Передаємо нативний бінарний File, який сервер Лами залізно розпізнає!
      purpose: "parse",
    });

    const fileId = fileResponse.id;
    console.log(
      `✅ [ETAП 1] Файл успішно прийнято сервером! File ID: ${fileId}`,
    );

    // 🏗️ ЕТАП 2 ТА 3 ЗА ДОКУМЕНТАЦІЄЮ: Запускаємо преміальний Agentic парсинг
    console.log(
      "⏳ [ETAП 2-3] Ініціалізація таску парсингу та автоматичний Polling статусів...",
    );
    const parseResult = await llamaClient.parsing.parse({
      file_id: fileId, // Наш суворий snake_case параметр
      tier: "agentic",
      version: "latest",
      expand: ["markdown"], // Просимо відразу повернути Markdown верстку сторінок
    });

    // Отримуємо готовий Markdown-контент
    if (
      !parseResult.markdown ||
      !parseResult.markdown.pages ||
      parseResult.markdown.pages.length === 0
    ) {
      throw new Error(
        "LlamaCloud успішно завершив таск, але повернув порожні сторінки Markdown.",
      );
    }

    // Збираємо текст з усіх сторінок книги до купи
    const extractedMarkdown = parseResult.markdown.pages
      .map((page: any) => page.markdown)
      .join("\n");
    console.log(
      `✅ [ETAП 3] Книгу успішно оцифровано! Отримано символів: ${extractedMarkdown.length}`,
    );

    // 🤖 ЕТАП 4: Передача розпізнаного тексту в OpenAI для структурування під базу даних
    console.log(
      "⏳ [КРОК 4] Ініціалізація структурування JSON через OpenAI GPT-4o...",
    );
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const safeTextSample = extractedMarkdown.substring(0, 45000);

    const structuringResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ти — системний девелопер та архітектор даних. Твоє завдання — структурувати розпізнаний текст підручника у валідний JSON-об'єкт.
{
  "title": "Офіційна назва підручника",
  "publisher": "Назва видавництва або Глобальний каталог IncluEd",
  "publishing_year": 2024,
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

    return JSON.parse(finalJsonString) as ParsedBookResult;
  } catch (error: any) {
    console.error("\n❌❌❌ КРИТИЧНИЙ ЗБІЙ В ОФІЦІЙНОМУ SDK-ПАЙПЛАЙНІ:");
    console.error(`Повідомлення про помилку: ${error.message}`);
    console.log("=======================================================\n");
    throw error;
  }
}
