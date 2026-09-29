// 📂 Шлях до файлу: utils/r2/llama-parser.ts
import LlamaCloud from "@llamaindex/llama-cloud";

/**
 * ☁️ ОФІЦІЙНИЙ СТАБІЛЬНИЙ КЛІЄНТ LLAMACLOUD API (Комміт ac1069a)
 * Приймає Base64 рядок, перетворює його в об'єкт File і лінійно чекає Markdown.
 */
export async function parseTextWithLlama(
  fileBase64: string,
  fileName: string,
): Promise<string> {
  console.log("\n=======================================================");
  console.log("🚀 [ЛАМА] ЗАПУСК ОПТИМІЗОВАНОГО КЛІЄНТА LLAMACLOUD v2 API");
  console.log(`Файл: ${fileName}`);
  console.log("=======================================================");

  try {
    // 1. Конвертуємо отриманий Base64 назад у чистий бінарний Buffer Node.js
    const fileBuffer = Buffer.from(fileBase64, "base64");

    // 🌟 Створюємо нативний Node.js об'єкт File для передачі в SDK
    const binaryFile = new File([fileBuffer], fileName || "book.pdf", {
      type: "application/pdf",
    });

    // 2. Ініціалізуємо офіційний клієнт LlamaIndex
    console.log("⏳ [ЛАМА] Ініціалізація LlamaCloud клієнта...");
    const llamaClient = new LlamaCloud({
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    // 📥 ЕТАП 1: Завантажуємо файл у хмару швидким бінарним пакетом
    console.log("⏳ [ЛАМА] Швидке завантаження файлу через files.create...");
    const fileResponse = await llamaClient.files.create({
      file: binaryFile,
      purpose: "parse",
    });

    const fileId = fileResponse.id;
    console.log(`✅ [ЛАМА] Файл успішно прийнято сервером! File ID: ${fileId}`);

    // 🏗️ ЕТАП 2 ТА 3: Запускаємо преміальний Agentic парсинг та Polling статусів
    console.log(
      "⏳ [ЛАМА] Ініціалізація таску парсингу та автоматичний Polling статусів...",
    );
    const parseResult = await llamaClient.parsing.parse({
      file_id: fileId,
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
      `✅ [ЛАМА] Книгу успішно оцифровано! Отримано символів: ${extractedMarkdown.length}`,
    );

    return extractedMarkdown;
  } catch (error: any) {
    console.error("\n❌❌❌ КРИТИЧНИЙ ЗБІЙ В ОФІЦІЙНОМУ SDK-ПАЙПЛАЙНІ:");
    console.error(`Повідомлення про помилку: ${error.message}`);
    console.log("=======================================================\n");
    throw error;
  }
}
