// 📂 Шлях до файлу: app/dashboard/upload/route.ts
// ==================== ЧАСТИНА 1 ====================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  parseMetadataFromFilename,
  validateNushMetadata,
  parsePdfTitlePage,
  checkFileHashOnly,
} from "@/app/utils/supabase/upload-helpers";

import {
  buildBookStructure,
  processAndStreamBookStructure,
} from "@/app/utils/supabase/upload-helpers/structure-builder";

import { uploadTextToR2, uploadBufferToR2 } from "@/app/utils/r2/r2-helpers";
import { getBookRawMarkdownKey } from "@/app/utils/r2/naming";

import LlamaCloud from "@llamaindex/llama-cloud";
import {
  uploadBookToLlamaCloudViaUrl,
  getLlamaParsingResult,
} from "@/app/utils/ai/llama-parser";

export const dynamic = "force-dynamic";

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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const fileHash = formData.get("fileHash") as string;
    const originalName = formData.get("originalName") as string;
    const subjectId = formData.get("subjectId") as string;
    const schoolClass = Number(formData.get("schoolClass"));
    const programId = (formData.get("programId") as string) || null;
    const clientFileKey = formData.get("fileKey") as string;

    // 🔄 ЕТАП 2: Реєстрація посилання та запуск асинхронного воркера
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

      const jobId = llamaResult.jobId;
      const cleanBookTitle = originalName
        .replace(/\.[^/.]+\$/, "")
        .replace(/[_-]/g, " ");

      console.log(
        `📝 Записуємо чисті метадані підручника в public.books: "${cleanBookTitle}"`,
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

      // 🚀 АВТОНОМНИЙ ІЗОЛЬОВАНИЙ ФОНОВИЙ ПРОЦЕС
      setImmediate(async () => {
        try {
          console.log(
            `📡 [BACKGROUND PROCESS] Фоновий воркер стартував для Job: ${jobId}`,
          );
          const client = new LlamaCloud();
          let isCompleted = false;
          let attempts = 0;
          const maxAttempts = 40;

          while (!isCompleted && attempts < maxAttempts) {
            attempts++;
            const parsing = await client.parsing.get(jobId);
            const currentStatus = ((parsing as any).job?.status || "")
              .trim()
              .toUpperCase();

            console.log(
              `⏳ [BACKGROUND PROCESS] Спроба ${attempts}/${maxAttempts}. Статус Лами: "${currentStatus}"`,
            );

            if (["SUCCESS", "COMPLETED"].includes(currentStatus)) {
              isCompleted = true;
              break;
            }
            if (["FAILED", "ERROR"].includes(currentStatus)) {
              throw new Error(
                (parsing as any).job?.error_message || "Llama parsing failed",
              );
            }
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }

          if (!isCompleted)
            throw new Error(
              "Перевищено ліміт часу очікування парсингу Llama Cloud.",
            );

          console.log(
            "📦 [BACKGROUND PROCESS] Лама готова! Завантажуємо контент через expand...",
          );
          const fullResponse = await getLlamaParsingResult(jobId, [
            "markdown",
            "images_content_metadata",
            "items",
          ]);

          // ==================== ОНОВЛЕНИЙ БЛОК ОБРОБКИ КОНТЕНТУ ====================
          // ==================== ОНОВЛЕНИЙ І ЗШИТИЙ БЛОК В ROUTE.TS ====================
          console.log(fullResponse);
          const fullJobData = fullResponse as any;

          const pages = fullJobData.markdown?.pages || [];
          const fullMarkdown = pages
            .sort((a: any, b: any) => a.page_number - b.page_number)
            .map((page: any) => page.markdown || "")
            .join("\n\n");

          if (!fullMarkdown || fullMarkdown.trim().length < 10) {
            throw new Error("Спарсений текст від Llama Cloud порожній.");
          }

          // Завантажуємо повну розмітку в R2 як бекап оригіналу документу
          await uploadTextToR2(getBookRawMarkdownKey(fileHash), fullMarkdown);

          // 🟢 ОЦЕЙ РЯДОК РОБИТЬ МІСТ ДО УНІВЕРСАЛЬНОГО ПАРСЕРА:
          // Ми витягуємо чистий масив сторінок із об'єкта items.pages, який прислала Лама
          const rawStructure = buildBookStructure(
            fullJobData.items?.pages || [],
          );

          // Стрімимо готові параграфи в сховище R2 та отримуємо мапу
          const bookStructureJsonb = await processAndStreamBookStructure(
            rawStructure,
            fileHash,
          );
          // ============================================================================

          // =========================================================================

          // ==================== ЧАСТИНА 2 ====================
          // 6. Контрольоване пакетне завантаження картинок (Батчі по 15 штук)
          const imagesMetadata = fullJobData.images_content_metadata;
          if (
            imagesMetadata &&
            Array.isArray(imagesMetadata.images) &&
            imagesMetadata.images.length > 0
          ) {
            const BATCH_SIZE = 15;
            const images = imagesMetadata.images;
            console.log(
              `📸 [BACKGROUND PROCESS] Виявлено медіафайлів: ${images.length}. Запуск пула завантаження...`,
            );

            for (let i = 0; i < images.length; i += BATCH_SIZE) {
              const batch = images.slice(i, i + BATCH_SIZE);
              console.log(
                `⏳ [BACKGROUND R2-MEDIA] Пакет медіа: з ${i} по ${Math.min(i + BATCH_SIZE, images.length)} з ${images.length}...`,
              );

              await Promise.all(
                batch.map(async (imgObj: any) => {
                  const imageName = imgObj.filename;
                  const presignedUrl = imgObj.presigned_url;
                  try {
                    if (!presignedUrl || !imageName) return;

                    const imageResponse = await fetch(presignedUrl);
                    if (!imageResponse.ok) return;

                    const buffer = Buffer.from(
                      await imageResponse.arrayBuffer(),
                    );
                    await uploadBufferToR2(
                      `books/content/${fileHash}/images/${imageName}`,
                      buffer,
                      imgObj.content_type || "image/jpeg",
                    );
                  } catch (err) {
                    // Пропускаємо дрібні мережеві помилки поодиноких картинок
                  }
                }),
              );
            }
            console.log(
              "🎉 [BACKGROUND PROCESS SUCCESS] Усі медіафайли успішно збережено в R2!",
            );
          }

          // 7. Оновлюємо JSON-мапу в таблицю public.books (Це тригерне підписку на фронті)
          console.log(
            "📝 [BACKGROUND PROCESS] Фіналізація: оновлюємо book_structure в public.books...",
          );
          await supabaseAdmin
            .from("books")
            .update({ book_structure: bookStructureJsonb })
            .eq("file_hash", fileHash);

          console.log(
            `🎉 [BACKGROUND PROCESS SUCCESS] Підручник ${fileHash} успішно та повністю зібрано!`,
          );
        } catch (bgError: any) {
          console.error(
            "❌ [BACKGROUND PROCESS CRITICAL ERROR]:",
            bgError.message,
          );
        }
      });

      // Миттєва відповідь фронтенду: модалка відразу штатно закривається!
      return NextResponse.json({
        success: true,
        status: "PROCESSING",
        llamaFileId: jobId,
      });
    }

    // ====================================================
    // 🔍 ЕТАП 1: Перші перевірки прев'ю файлу, метаданих НУШ та дедуплікація (Ваш оригінальний код)
    // ====================================================
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
    const serverNodeBuffer = Buffer.from(await miniPreviewFile.arrayBuffer());
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
