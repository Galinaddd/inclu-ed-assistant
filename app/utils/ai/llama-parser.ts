// app/utils/ai/llama-parser.ts
import LlamaCloud from "@llamaindex/llama-cloud";
import fs from "fs";
import path from "path";
import os from "os";

// Ініціалізуємо офіційний клієнт (автоматично читає LLAMA_CLOUD_API_KEY з .env)
const client = new LlamaCloud();

export interface LlamaJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * 🚀 ШІ-ХЕЛПЕР 1: Завантаження фізичного підручника до Llama Cloud через канонічний ReadStream
 * ✨ ОФІЦІЙНО: Використовує fs.createReadStream точно за твоєю документацією Llama Cloud!
 */
export async function uploadBookToLlamaCloudViaUrl(
  fileBuffer: Buffer,
  fileName: string,
): Promise<LlamaJobResult> {
  let tempFilePath = "";

  try {
    console.log(
      `📡 [LLAMA-PARSER] Створення тимчасового файлу для підпису метаданих: ${fileName}`,
    );

    // 1. Створюємо безпечний тимчасовий шлях у системній папці операційної системи (/tmp)
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);

    // 2. На одну секунду записуємо байти з R2 на диск сервера
    fs.writeFileSync(tempFilePath, fileBuffer);

    console.log(
      "📡 [LLAMA-PARSER] Створення канонічного ReadStream та надсилання до Llama Cloud...",
    );

    // 3. 🔥 ПЕРЕДАЄМО СТРІМ — ТОЧНІСІНЬКО ЯК У ТВОЇХ ДОКАХ!
    // Завдяки цьому Лама отримає легітимне ім'я файлу, розширення .pdf і не впаде за таймаутом.
    const uploadResult = await client.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: "parse",
    });

    if (!uploadResult || !uploadResult.id) {
      throw new Error("Llama Cloud SDK не повернув унікальний ID файлу.");
    }

    console.log(
      `✅ [LLAMA-PARSER УСПІХ] Файл успішно прийнято Ламою. ID: ${uploadResult.id}`,
    );

    // 4. Миттєво видаляємо тимчасовий файл за собою, щоб не засмічувати пам'ять сервера
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return {
      success: true,
      jobId: uploadResult.id,
    };
  } catch (error: any) {
    // Якщо сталася помилка, все одно гарантовано підчищаємо диск
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    console.error("❌ [LLAMA-PARSER CRITICAL ERROR]:", error.message);
    return {
      success: false,
      error:
        error.message || "Помилка завантаження файлу через Llama Cloud SDK.",
    };
  }
}

/**
 * 🚀 ШІ-ХЕЛПЕР 2: Перевірка статусу черги та отримання результату
 */
export async function getLlamaParsingResult(jobId: string) {
  try {
    const result = await client.parsing.parse({
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
