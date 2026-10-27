import LlamaCloud from "@llamaindex/llama-cloud";
import fs from "fs";

async function main() {
  try {
    // Ініціалізуємо офіційний клієнт строго за правилами SDK для європейського регіону
    const client = new LlamaCloud({
      apiKey: process.env.LLAMA_CLOUD_API_KEY, // Твій новий робочий ключ
      //   baseURL: "https://api.cloud.eu.llamaindex.ai", // Європейська адреса для API з доків
    });

    console.log("1. Завантажуємо файл у LlamaCloud EU...");

    // Завантажуємо локальний файл 1.pdf
    const file = await client.files.create({
      file: fs.createReadStream("./1.pdf"),
      purpose: "parse",
    });

    console.log(`✅ Файл успішно завантажено! ID: ${file.id}`);
    console.log("2. Запускаємо процес парсингу (Agentic tier)...");

    // Запускаємо парсинг через офіційний метод
    const result = (await client.parsing.parse({
      file_id: file.id,
      tier: "agentic",
      version: "latest",
      expand: ["markdown"],
    })) as any;

    console.log("\n--- РЕЗУЛЬТАТ ПАРСИНГУ (Сторінка 1) ---");

    // Виводимо отриманий маркдаун у консоль
    if (result?.markdown?.pages?.[0]?.markdown) {
      console.log(result.markdown.pages[0].markdown);
    } else {
      console.log(
        "Парсинг завершено, але структура відповіді відрізняється. Повний результат:",
      );
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("❌ Помилка при виконанні скрипта:", error);
  }
}

main();
