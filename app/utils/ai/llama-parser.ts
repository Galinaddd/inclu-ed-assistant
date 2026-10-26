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
export async function uploadBookToLlamaCloudViaUrl(
  publicR2Url: string,
  fileName: string,
): Promise<LlamaJobResult> {
  try {
    console.log(`📡 [LLAMA] Надсилання source_url: ${fileName}`);

    // Передаємо параметри строго за твоїм першим скриншотом документації
    const job = await client.parsing.create({
      source_url: publicR2Url,
      tier: "agentic",
      version: "latest",
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
 * Згідно з твоїм боковим меню, цей метод закриває і статус, і результат.
 */
export async function getLlamaParsingResult(jobId: string) {
  try {
    console.log(
      `📥 [LLAMA-PARSER] Опитування завдання через GET за ID: ${jobId}`,
    );

    // 🔥 ВИПРАВЛЕНО ДЛЯ STAINLESS SDK: Передаємо чистий рядок, як вимагає TypeScript!
    const result = await client.parsing.get(jobId);

    return result;
  } catch (error: any) {
    console.error(`❌ [LLAMA GET ERROR] ${jobId}:`, error.message);
    throw error;
  }
}
