// 📂 Шлях до файлу: app/dashboard/upload/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createBookAndStreamContentsToR2 } from "@/app/utils/supabase/upload-helpers";
import LlamaCloud from "@llamaindex/llama-cloud";

export const maxDuration = 900;

const llamaClient = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
});

/**
 * 🔍 ЕТАП 2 АСИНХРОННОГО ПАЙПЛАЙНУ: ЦИКЛІЧНЕ ОПИТУВАННЯ СТАТУСУ ТА АСИНХРОННИЙ КОММІТ ОБКЛАДИНКИ
 */
export async function POST(request: NextRequest) {
  console.log("\n=======================================================");
  console.log("🔍 [API-РОУТ STATUS] ПЕРЕВІРКА СТАТУСУ ТА АСИНХРОННИЙ КОММІТ");
  console.log("=======================================================");

  try {
    // 🔐 ЗОЛОТИЙ АДМІН-КОННЕКШН ДЛЯ ЗАЛІЗОБЕТОННОГО ОБХОДУ ПОМИЛКИ RLS!
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const data = await request.json();
    const {
      llamaFileId,
      fileName,
      fileHash,
      subjectId,
      schoolClass,
      programId,
      detectedYear,
      expectedSubjectName,
    } = data;

    if (!llamaFileId || !fileHash || !subjectId || !schoolClass) {
      return NextResponse.json(
        { success: false, error: "Критична помилка: Відсутні метадані таску." },
        { status: 400 },
      );
    }

    // 1. Швидкий мережевий запит статусу Лами у динамічному режимі auto
    const parseResult = (await llamaClient.parsing.parse({
      file_id: llamaFileId,
      tier: "auto",
      version: "latest",
      expand: ["markdown"],
    })) as any;

    if (!parseResult) throw new Error("LlamaCloud повернув порожню відповідь.");

    const pages = parseResult.markdown?.pages || [];
    const currentStatus = "status" in parseResult ? parseResult.status : "";

    // Поки ШІ-агенти Лами ще крутять сторінки книги — миттєво відпускаємо клієнта
    if (currentStatus !== "SUCCESS" && pages.length === 0) {
      if (currentStatus === "FAILED" || currentStatus === "ERROR") {
        throw new Error(`LlamaCloud повернув статус помилки: ${currentStatus}`);
      }
      return NextResponse.json({ success: true, status: "PROCESSING" });
    }

    // 2. Лама успішно фінішувала! Збираємо оригінальний суцільний Markdown контент книги
    const rawMarkdown = pages
      .map((page: any) => (page && "markdown" in page ? page.markdown : ""))
      .join("\n");

    if (!rawMarkdown || rawMarkdown.trim().length < 10) {
      throw new Error(
        "LlamaCloud повернув успішний статус, але порожній контент тексту.",
      );
    }

    // 3. ✨ БЕЗПЕЧНЕ АСИНХРОННЕ ОДЕРЖАННЯ БУФЕРА ДЛЯ ОБКЛАДИНКИ
    // Стягуємо вихідний бінарний файл прямо з LlamaCloud за одну команду, щоб вирізати обкладинку!
    console.log(
      "⏳ Завантаження бінарного буфера файлу з LlamaCloud для вирізання обкладинки...",
    );
    const fileContentResponse = await fetch(
      `https://llamaindex.ai{llamaFileId}/content`,
      {
        headers: { Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}` },
      },
    );

    if (!fileContentResponse.ok) {
      throw new Error(
        "Не вдалося завантажити бінарний буфер файлу з хмари Лами.",
      );
    }

    const arrayBuffer = await fileContentResponse.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 4. Викликаємо нашу спільну функцію: вона сама у фоні виріже обкладинку в PNG,
    // завантажить в R2, створить книгу без RLS та наріже преміальний Markdown контент уроків!
    const finalBook = await createBookAndStreamContentsToR2(supabaseAdmin, {
      rawMarkdown,
      fileName,
      fileHash,
      subjectId,
      schoolClass,
      programId,
      publishingYear: Number(detectedYear) || new Date().getFullYear(),
      fileBuffer, // Передаємо бінарний буфер для асинхронного малювання сторінки 1
    });

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      data: finalBook,
    });
  } catch (error: any) {
    console.error("❌ КРИТИЧНИЙ ЗБІЙ РОУТУ СТАТУСУ НА ЕТАПІ 2:", error.message);
    return NextResponse.json(
      {
        success: false,
        error:
          error.message || "Збій під час фінальної структуризації контенту.",
      },
      { status: 500 },
    );
  }
}
