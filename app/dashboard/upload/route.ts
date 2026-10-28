// 📂 Шлях до файлу: app/dashboard/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // Чистий бекенд-клієнт без куків
import {
  parseMetadataFromFilename,
  validateNushMetadata,
  parsePdfTitlePage,
  checkFileHashOnly,
} from "@/app/utils/supabase/upload-helpers";

// Імпортуємо обидва хелпери структури з нашого файлу structure-builder
import {
  buildBookStructure,
  processAndStreamBookStructure,
} from "@/app/utils/supabase/upload-helpers/structure-builder";

// Імпортуємо чисті функції неймінгу та утиліту завантаження
import { uploadTextToR2 } from "@/app/utils/r2/r2-helpers";
import { getBookRawMarkdownKey } from "@/app/utils/r2/naming";

import LlamaCloud from "@llamaindex/llama-cloud";
import { uploadBookToLlamaCloudViaUrl } from "@/app/utils/ai/llama-parser";
import { runTextAdaptationPipeline } from "@/app/utils/ai/adaptation-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ExtendedParsingResponse {
  job: {
    id: string;
    status: string;
    error_message?: string | null;
  };
  markdown?: {
    pages?: Array<{ markdown?: string }>;
  } | null;
}

// 🔑 ЗАЛІЗОБЕТОННИЙ СУПЕРАДМІН ДЛЯ ОБХОДУ RLS (Чистий синглтон для роуту)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 🔄 ЕНДПОЇНТ 1 (GET): Легкий полінг статусу + Швидка паралельна фіналізація
 */
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    const fileHash = request.nextUrl.searchParams.get("fileHash");

    if (!jobId || !fileHash) {
      return NextResponse.json(
        { success: false, error: "jobId та fileHash обов'язкові." },
        { status: 400 },
      );
    }

    const client = new LlamaCloud();
    const parsing = await client.parsing.get(jobId);
    const jobData = parsing as unknown as ExtendedParsingResponse;
    const currentStatus = (jobData.job?.status || "").trim().toUpperCase();

    console.log(
      `📡 [GET POLL] Job: ${jobId} | Статус Лами: "${currentStatus}"`,
    );

    if (
      ["PENDING", "PROCESSING", "RUNNING", "DEFAULT", ""].includes(
        currentStatus,
      )
    ) {
      return NextResponse.json({ success: true, status: "PROCESSING" });
    }

    if (["SUCCESS", "COMPLETED"].includes(currentStatus)) {
      console.log(
        "🎉 Лама завершила роботу! Запитуємо контент через expand...",
      );

      const fullResponse = await client.parsing.get(jobId, {
        expand: ["markdown"],
      });
      const fullJobData = fullResponse as unknown as ExtendedParsingResponse;
      const pages = fullJobData.markdown?.pages || [];
      const fullMarkdown = pages
        .map((page) => page.markdown || "")
        .join("\n\n");

      if (!fullMarkdown || fullMarkdown.trim().length < 10) {
        throw new Error(
          "Спарсений текст від Llama Cloud порожній. Перевірте файл.",
        );
      }

      // 💾 КРОК 1: Збереження повного тексту в R2 (Recovery бекап)
      const rawMarkdownKey = getBookRawMarkdownKey(fileHash);
      await uploadTextToR2(rawMarkdownKey, fullMarkdown);

      // 🔮 КРОК 2: Текстова нарізка структури (Ваш оригінальний Regex-білдер)
      const rawStructure = buildBookStructure(fullMarkdown);

      // 🚀 КРОК 3: БЛИСКАВИЧНИЙ СТРІМІНГ ПАРАГРАФІВ В R2 (Через Promise.all)
      const bookStructureJsonb = await processAndStreamBookStructure(
        rawStructure,
        fileHash,
      );

      // ====================================================
      // 💾 КРОК 4: ОНОВЛЕННЯ JSON-МАПИ В ТАБЛИЦЮ public.books (Через Адміна)
      // ====================================================
      console.log(
        "📝 Додаємо готову структуру книги в колонку book_structure таблиці public.books...",
      );
      const { data: updatedBook, error: bookError } = await supabaseAdmin
        .from("books")
        .update({
          book_structure: bookStructureJsonb,
        })
        .eq("file_hash", fileHash)
        .select()
        .maybeSingle();

      if (bookError) {
        throw new Error(
          `Помилка оновлення book_structure в public.books: ${bookError.message}`,
        );
      }

      // ====================================================
      // 🛡️ ОБГОРТАЄМО ШІ-АДАПТАЦІЮ, ЩОБ ЛІМІТИ OPENAI НЕ ЛАМАЛИ ЗАВАНТАЖЕННЯ КНИГИ
      // ====================================================
      try {
        console.log("🤖 Запуск фонового пайплайну ШІ-адаптації...");
        await runTextAdaptationPipeline({
          userId: "system",
          text: fullMarkdown,
          userRole: "teacher",
          subjectName: "Предмет НУШ",
          contentType: "text",
          clientChildData: { id: "system-upload" } as any,
        });
        console.log("✅ Пайплайн ШІ-адаптації успішно виконано.");
      } catch (aiError: any) {
        console.error(
          "⚠️ [OPENAI WARNING] Помилка ШІ-адаптатора (перевірте баланс OpenAI):",
          aiError.message,
        );
      }

      console.log(
        "✅ [УСПІХ] Структуру книги успішно записано, акордеон готовий!",
      );
      return NextResponse.json({
        success: true,
        status: "SUCCESS",
        data: updatedBook || null,
      });
    }

    return NextResponse.json({
      success: true,
      status: "FAILED",
      error: jobData.job?.error_message || "Збій Лами на стороні хмари.",
    });
  } catch (error: any) {
    console.error(`❌ [GET POLL CRITICAL ERROR]:`, error.message);
    return NextResponse.json(
      { success: false, status: "FAILED", error: error.message },
      { status: 500 },
    );
  }
}

/**
 * 🛫 ЕНДПОЇНТ 2 (POST): Валідація ТА Первинне створення оригінальної книги (В обхід RLS)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const fileHash = formData.get("fileHash") as string;
    const originalName = formData.get("originalName") as string;
    const subjectId = formData.get("subjectId") as string;
    const schoolClass = Number(formData.get("schoolClass"));
    const programId = (formData.get("programId") as string) || null;
    const clientFileKey = formData.get("fileKey") as string;

    if (clientFileKey) {
      console.log(
        "⏳ [POST] Миттєва реєстрація публічного лінку R2 в Llama Cloud...",
      );

      const r2PublicDomain =
        process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || "https://r2.dev";
      const r2PublicUrl = `${r2PublicDomain}/${clientFileKey}`;

      const llamaResult = await uploadBookToLlamaCloudViaUrl(
        r2PublicUrl,
        originalName,
      );

      if (!llamaResult.success || !llamaResult.jobId) {
        throw new Error(
          `Помилка ініціалізації в Llama Cloud: ${llamaResult.error}`,
        );
      }

      // Відмиваємо назву підручника
      const cleanBookTitle = originalName
        .replace(/\.[^/.]+\$/, "")
        .replace(/[_-]/g, " ");

      // 🔥 Інсертимо через залізобетонний supabaseAdmin в обхід RLS
      console.log(
        `📝 Записуємо чисті метадані підручника в public.books (Bypass RLS): "${cleanBookTitle}"`,
      );
      const { error: insertError } = await supabaseAdmin.from("books").insert({
        file_hash: fileHash,
        title: cleanBookTitle,
        subject_id: subjectId,
        school_class: schoolClass,
        program_id: programId,
        publishing_year: 2026,
        publisher: "Видавництво НУШ",
        cover_url: "/images/default-book-cover.png",
        parent_book_id: null,
        book_structure: [],
      });

      if (insertError) {
        throw new Error(
          `Помилка створення картки в таблиці books: ${insertError.message}`,
        );
      }

      return NextResponse.json({
        success: true,
        status: "PROCESSING",
        llamaFileId: llamaResult.jobId,
      });
    }

    const miniPreviewFile = formData.get("file") as File;
    const expectedSubjectName =
      (formData.get("subjectName") as string) || "Предмет НУШ";

    if (!miniPreviewFile || !fileHash) {
      return NextResponse.json(
        { success: false, error: "Критичні дані файлу відсутні." },
        { status: 400 },
      );
    }

    const fromFilename = parseMetadataFromFilename(originalName);
    const clientArrayBuffer = await miniPreviewFile.arrayBuffer();
    const serverNodeBuffer = Buffer.from(clientArrayBuffer);
    const safeServerFile = new File([serverNodeBuffer], originalName, {
      type: "application/pdf",
    });
    const fromContent = await parsePdfTitlePage(safeServerFile, fileHash);

    if (
      fromFilename.detectedSubject &&
      fromContent.detectedSubject &&
      fromFilename.detectedSubject !== fromContent.detectedSubject
    ) {
      throw new Error(
        `🚨 Помилка відповідності файлу! Назва файлу та вміст сторінок вказують на різні предмети.`,
      );
    }

    const finalDetectedClass =
      fromContent.detectedClass || fromFilename.detectedClass || schoolClass;
    const finalDetectedSubject =
      fromContent.detectedSubject ||
      fromFilename.detectedSubject ||
      expectedSubjectName;
    const finalDetectedYear =
      fromContent.detectedYear ||
      fromFilename.detectedYear ||
      new Date().getFullYear();

    validateNushMetadata(
      {
        detectedClass: finalDetectedClass,
        detectedSubject: finalDetectedSubject,
      },
      schoolClass,
      expectedSubjectName,
    );

    // Передаємо наш адмінський клієнт у дедуплікатор
    const duplicateResult = await checkFileHashOnly(supabaseAdmin, {
      fileHash,
      subjectId,
      schoolClass,
      programId,
    });

    if (duplicateResult.isDuplicate) {
      return NextResponse.json({
        success: true,
        status: "DUPLICATE",
        data: duplicateResult.data,
      });
    }

    return NextResponse.json({
      success: true,
      status: "VALIDATED",
      detectedYear: finalDetectedYear,
    });
  } catch (error: any) {
    console.error("❌ [КРИТИЧНИЙ ЗБІЙ РОУТУ]:", error.message);
    const isValidationError =
      error.message?.includes("🚨") ||
      error.message?.includes("Помилка") ||
      error.message?.includes("відповідності");
    return NextResponse.json(
      { success: false, error: error.message },
      { status: isValidationError ? 422 : 500 },
    );
  }
}
