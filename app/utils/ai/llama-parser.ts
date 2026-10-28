// 📂 Шлях до файлу: app/utils/ai/llama-parser.ts
import LlamaCloud from "@llamaindex/llama-cloud";

const client = new LlamaCloud();

export interface LlamaJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * 🛫 КРОК 1: Ініціалізація асинхронного парсингу в хмарі Llama Cloud
 */
// 📂 Шлях до файлу: app/utils/ai/llama-parser.ts

export async function uploadBookToLlamaCloudViaUrl(
  publicR2Url: string,
  fileName: string,
): Promise<LlamaJobResult> {
  try {
    console.log(`📡 [LLAMA] Надсилання source_url: ${fileName}`);

    // Параметри строго відповідають структурі ParsingCreateParams із документації API v2
    const job = await client.parsing.create({
      source_url: publicR2Url,
      tier: "cost_effective", // Збалансований мультимодальний режим
      version: "latest",
      output_options: {
        // Замовляємо збереження вирізаних фігур (layout) та вбудованих картинок (embedded)
        images_to_save: ["layout", "embedded"],
      },
    });

    if (!job || !job.id)
      throw new Error("Llama Cloud SDK не повернув ID завдання.");

    return { success: true, jobId: job.id };
  } catch (error: any) {
    console.error("❌ [LLAMA REQ ERROR]:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 🛬 КРОК 2: Отримання статусу та даних завдання через канонічний метод GET
 * Додано параметр expand для отримання додаткових метаданих (текст, markdown, картинки)
 */
export async function getLlamaParsingResult(jobId: string, expand?: string[]) {
  try {
    console.log(
      `📥 [LLAMA-PARSER] Опитування завдання через GET за ID: ${jobId}. Expand: ${expand?.join(", ") || "none"}`,
    );

    // Передаємо jobId першим аргументом, а об'єкт конфігурації з query — другим
    const result = await client.parsing.get(
      jobId,
      expand ? { expand } : undefined,
    );

    return result;
  } catch (error: any) {
    console.error(`❌ [LLAMA GET ERROR] ${jobId}:`, error.message);
    throw error;
  }
}
