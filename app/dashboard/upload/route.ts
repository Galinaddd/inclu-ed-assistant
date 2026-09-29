// 📂 Шлях до файлу: app/dashboard/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminServerConnection } from "@/app/utils/supabase/server";
import LlamaCloud from "@llamaindex/llama-cloud";

export const maxDuration = 900;

const llamaClient = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
});

/**
 * 🛫 ЕТАП 1 АСИНХРОННОГО ПАЙПЛАЙНУ: МИТТЄВИЙ ПРИЙОМ ТА РЕЄСТРАЦІЯ ТАСКУ
 * Приймає важкий файл бінарним потоком, робить дедуплікацію,
 * реєструє таск у LlamaCloud і відразу відпускає HTTP-запит клієнта.
 */
export async function POST(request: NextRequest) {
  console.log("\n=======================================================");
  console.log("📥 [API-РОУТ] СТАРТ ПОТOКОВОГО ВИВАНТАЖЕННЯ КНИГИ");
  console.log("=======================================================");

  try {
    const supabase = await createAdminServerConnection();

    // 1. Зчитуємо Multipart FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileHash = formData.get("fileHash") as string;

    if (!file || !fileHash) {
      return NextResponse.json(
        { success: false, error: "Критична помилка: Файл або хеш відсутні." },
        { status: 400 },
      );
    }

    console.log(`📄 Перевірка дедуплікації для файлу: ${file.name}`);

    // 2. Глобальна дедуплікація НУШ: якщо книга вже є в базі, ШІ взагалі не потрібен
    const { data: existingBook, error: searchError } = await supabase
      .from("books")
      .select("id, title, publisher, publishing_year")
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (searchError) throw searchError;

    if (existingBook) {
      console.log("🎯 [ДЕДУПЛІКАЦІЯ] Книга вже існує. Миттєве повернення.");
      return NextResponse.json({
        success: true,
        status: "DUPLICATE",
        data: existingBook,
      });
    }

    // 3. Конвертуємо потік у нативний бінарний Buffer Node.js
    console.log("⏳ Перетворення потоку в бінарний Buffer...");
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Створюємо сумісний потоковий File об'єкт для офіційного SDK Лами
    const binaryFile = new File([buffer], file.name || "book.pdf", {
      type: "application/pdf",
    });

    console.log(
      "⏳ Відправка бінарного потоку через офіційний files.create...",
    );
    const fileResponse = await llamaClient.files.create({
      file: binaryFile,
      purpose: "parse",
    });

    console.log(
      `✅ [ЛАМА] Таск успішно створено у хмарі! Llama File ID: ${fileResponse.id}`,
    );

    // Миттєва відповідь клієнту! Запит закривається за кілька секунд, таймаут у продакшені неможливий
    return NextResponse.json({
      success: true,
      status: "PROCESSING",
      llamaFileId: fileResponse.id,
      fileName: file.name,
    });
  } catch (error) {
    const err = error as Error;
    console.error("❌ КРИТИЧНА ПОМИЛКА НА ЕТАПІ ІНІЦІАЛІЗАЦІЇ:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
