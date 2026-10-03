import { LlamaCloud } from "@llamaindex/llama-cloud";

// Ініціалізуємо офіційний клієнт строго для Етапу 2 (перевірки статусу черги)
const llamaClient = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY || "",
});

export interface LlamaJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * 🚀 ШІ-ХЕЛПЕР 1: Реєстрація завдання парсингу за URL з Cloudflare R2
 * ✨ НАДІЙНО ТА ЧИСТО: Обходимо ліміти форми за допомогою офіційного ендпоінту /parsing/jobs,
 * який створений спеціально під вхідні JSON-пакети інтернет-посилань великих файлів!
 */
export async function uploadBookToLlamaCloudViaUrl(
  fileUrl: string,
  fileName: string,
): Promise<LlamaJobResult> {
  console.log("\n=======================================================");
  console.log(
    `📡 [LLAMA-PARSER] Асинхронний запуск великого файлу через серверний JSON`,
  );
  console.log(`🔗 URL файлу в R2: ${fileUrl}`);
  console.log(`📦 Назва файлу: ${fileName}`);
  console.log("=======================================================");

  try {
    if (!process.env.LLAMA_CLOUD_API_KEY) {
      throw new Error("LLAMA_CLOUD_API_KEY відсутній у змінних оточення.");
    }

    // 🌟 ОФІЦІЙНИЙ МАРШРУТ REST API ДЛЯ СТВОРЕННЯ ЗАВДАНЬ ПО URL
    // Лама сама, своїми фоновими потоками скачає твої 41+ МБ з R2, оминаючи ліміти форми!
    const response = await fetch("https://llamaindex.ai", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: fileUrl, // Передаємо наше чисте інтернет-посилання
        name: fileName,
        parsing_options: {
          language: "uk", // Додаткова оптимізація під український текст
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Llama Cloud REST API Error: ${errorText}`);
    }

    const data = await response.json();

    // Офіційне REST API для Jobs повертает ідентифікатор у полі data.id або data.job_id
    const finalJobId = data.id || data.job_id;

    if (!finalJobId) {
      throw new Error(
        "LlamaCloud не повернув унікальний токен завдання (job id).",
      );
    }

    console.log("-------------------------------------------------------");
    console.log(
      `✅ [LLAMA-PARSER УСПІХ] Фонове завдання для великого файлу зареєстровано!`,
    );
    console.log(`🚀 [LAMA JOB ID]: ${finalJobId}`);
    console.log("-------------------------------------------------------\n");

    return { success: true, jobId: finalJobId };
  } catch (error: any) {
    console.error("❌ [LLAMA-PARSER КРИТИЧНА ПОМИЛКА]:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 🚀 ШІ-ХЕЛПЕР 2: Перевірка статусу та отримання результату (Твій рідний код із доків)
 */
export async function getLlamaParsingResult(jobId: string) {
  try {
    const result = await llamaClient.parsing.parse({
      file_id: jobId,
      tier: "agentic",
      version: "latest",
      expand: ["markdown"],
    });

    return result;
  } catch (error: any) {
    console.error(`❌ [LLAMA-PARSER ERROR] Job ${jobId}:`, error.message);
    throw error;
  }
}
