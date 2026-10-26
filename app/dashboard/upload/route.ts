// 📂 Шлях до файлу: app/dashboard/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminServerConnection } from "@/app/utils/supabase/server";
import {
  parseMetadataFromFilename,
  validateNushMetadata,
  parsePdfTitlePage,
  checkFileHashOnly,
} from "@/app/utils/supabase/upload-helpers";
import LlamaCloud from "@llamaindex/llama-cloud";

import { uploadBookToLlamaCloudViaUrl } from "@/app/utils/ai/llama-parser";
import { runTextAdaptationPipeline } from "@/app/utils/ai/adaptation-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 🧠 Строгий інтерфейс відповіді строго за схемою з твоєї документації
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

/**
 * 🔄 ЕНДПОЇНТ 1 (GET): Легкий полінг статусу + Автоматична важка фіналізація
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

    // 1. Швидкий запит статусу черги (без expand, щоб не вантажити мережу)
    const parsing = await client.parsing.get(jobId);
    const jobData = parsing as unknown as ExtendedParsingResponse;
    const currentStatus = (jobData.job?.status || "").trim().toUpperCase();

    console.log(
      `📡 [GET POLL] Job: ${jobId} | Статус Лами: "${currentStatus}"`,
    );

    // Якщо Лама все ще в процесі обробки — тримаємо полінг
    if (
      ["PENDING", "PROCESSING", "RUNNING", "DEFAULT", ""].includes(
        currentStatus,
      )
    ) {
      return NextResponse.json({ success: true, status: "PROCESSING" });
    }

    // 2. Якщо Лама відповіла SUCCESS або COMPLETED — стягуємо текст з expand строго за твоїм лінком доків!
    if (["SUCCESS", "COMPLETED"].includes(currentStatus)) {
      console.log(
        "🎉 Лама завершила роботу! Запитуємо контент через expand...",
      );

      // 🔥 СУВOРО ЗА ДОКУМЕНТАЦІЄЮ: Передаємо параметри розширення другим аргументом
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

      console.log(
        `[GET] Текст успішно витягнуто (${fullMarkdown.length} симв.). Запуск ШІ-адаптора НУШ...`,
      );

      await runTextAdaptationPipeline({
        userId: "system",
        text: fullMarkdown,
        userRole: "teacher",
        subjectName: "Предмет НУШ",
        contentType: "text",
        clientChildData: { id: "system-upload" } as any,
      });

      const supabase = await createAdminServerConnection();

      // Активуємо книгу в системі
      const { data: updatedBook } = await supabase
        .from("textbooks")
        .update({ status: "COMPLETED" })
        .eq("file_hash", fileHash)
        .select()
        .single();

      console.log("✅ [УСПІХ] Книгу повністю адаптовано та збережено!");
      return NextResponse.json({
        success: true,
        status: "SUCCESS",
        data: updatedBook,
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
 * 🛫 ЕНДПОЇНТ 2 (POST): Валідація прев'ю ТА Миттєвий транзит source_url
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAdminServerConnection();
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

      await supabase.from("textbooks").insert({
        file_hash: fileHash,
        name: originalName,
        subject_id: subjectId,
        school_class: schoolClass,
        program_id: programId,
        status: "PROCESSING",
      });

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

    const duplicateResult = await checkFileHashOnly(supabase, {
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
