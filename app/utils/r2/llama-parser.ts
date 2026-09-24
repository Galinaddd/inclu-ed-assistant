// 📂 Шлях до файлу: utils/r2/llama-parser.ts
import LlamaCloud from "@llamaindex/llama-cloud"; // Наш дефолтний імпорт

export async function parseTextWithLlama(
  fileBase64: string,
  fileName: string,
): Promise<string> {
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

    return extractedMarkdown;
  } catch (error: any) {
    console.error("\n❌❌❌ КРИТИЧНИЙ ЗБІЙ В ОФІЦІЙНОМУ SDK-ПАЙПЛАЙНІ:");
    console.error(`Повідомлення про помилку: ${error.message}`);
    console.log("=======================================================\n");
    throw error;
  }
}
