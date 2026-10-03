"use server";
import {
  checkFileHashOnly,
  parsePdfTitlePage,
  validateNushMetadata,
  parseMetadataFromFilename,
  BookData,
} from "@/app/utils/supabase/upload-helpers";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createAdminServerConnection } from "@/app/utils/supabase/server";
// 🌟 ІМПОРТУЄМО ТВІЙ РІДНИЙ КЛІЄНТ R2
import { r2Client, R2_BUCKET_NAME } from "@/app/utils/r2/r2";
import { createBookAndStreamContentsToR2 } from "@/app/utils/r2/r2-streamer";
// 🌟 Знайди свій імпорт хелперів і додай туди downloadTextFromR2 та uploadTextToR2:
import { uploadTextToR2, downloadTextFromR2 } from "@/app/utils/r2/r2-helpers";
// 🌟 Додай імпорт параметрів та пайплайну адаптації з твого ШІ-модуля:
import { runTextAdaptationPipeline } from "@/app/utils/ai/adaptation-service";
import {
  uploadBookToLlamaCloudViaUrl,
  getLlamaParsingResult,
} from "@/app/utils/ai/llama-parser";

export interface InitializeUploadResponse {
  success: boolean;
  status: "PROCESSING" | "DUPLICATE" | "VALIDATED";
  uploadUrl?: string;
  fileKey?: string;
  fileHash?: string;
  fileName?: string;
  detectedYear?: number | null;
  data?: any;
  error?: string;
  statusCode?: number;
}

interface NewCheckStatusParams {
  jobId: string;
  fileHash: string;
  subjectId: string;
  schoolClass: number;
  programId: string | null;
  detectedYear: number;
  fileName: string;
  fileKey: string;
}

interface AdaptTextParams {
  text: string;
  userId: string;
  userRole: "teacher" | "family";
  subjectName: string;
  contentType: "text" | "attachment" | "test";
  clientChildData: {
    // ✨ Додаємо жорстку типізацію під наш швидкий флоу
    id: string;
    child_name: string;
    school_class: number;
    support_level: number;
    child_age: number;
    diagnosis_code: string;
    diagnosis_title: string;
  };
}
/**
 * 🛡️ ОСОБЛИВИЙ ЕКШЕН 1: ЛАНЦЮЖОК АНАЛІТИЧНИХ ПЕРЕВІРОК НУШ
 * Виконує суворо контроль вчителя, дедуплікацію в базі Supabase і більше нічого!
 */
export async function verifyBookMetadataAction(
  formData: FormData,
): Promise<InitializeUploadResponse> {
  console.log("\n=======================================================");
  console.log("🔍 [SERVER ACTION] ЗАПУСК ІЗОЛЬОВАНОГО ЛАНЦЮЖКА ПЕРЕВІРОК");
  console.log("=======================================================");

  try {
    const supabase = await createAdminServerConnection();

    const miniPreviewFile = formData.get("file") as File;
    const originalName = formData.get("originalName") as string; // Справжнє ім'я книги
    const fileHash = formData.get("fileHash") as string;
    const subjectId = formData.get("subjectId") as string;
    const schoolClass = Number(formData.get("schoolClass"));
    const expectedSubjectName =
      (formData.get("subjectName") as string) || "Предмет НУШ";
    const programId = (formData.get("programId") as string) || null;

    if (!miniPreviewFile || !fileHash || !originalName) {
      return {
        success: false,
        status: "PROCESSING",
        error: "Критичні дані файлу відсутні.",
        statusCode: 400,
      };
    }

    // --------------------------------------------------------
    // КРОК 1: ВИКЛИК ЧИСТИХ ДАТЧИКІВ ПО ЧЕРЗІ
    // --------------------------------------------------------
    console.log(
      `[АНАЛІТИКА 🔍] 1. Опитування датчиків розпізнавання рядків та сторінок...`,
    );

    const fromFilename = parseMetadataFromFilename(originalName);
    const fromContent = await parsePdfTitlePage(miniPreviewFile, fileHash);

    // Зводимо сирі дані докупи (пріоритет віддаємо тексту PDF сторінок)
    let finalDetectedClass: number | null =
      fromContent.detectedClass || fromFilename.detectedClass;
    let finalDetectedSubject: string | null =
      fromContent.detectedSubject || fromFilename.detectedSubject;
    let finalDetectedYear =
      fromContent.detectedYear ||
      fromFilename.detectedYear ||
      new Date().getFullYear();

    // --------------------------------------------------------
    // КРОК 2: ПЕРЕХРЕСНЕ ПОРІВНЯННЯ (Пошук конфліктів у самому файлі)
    // --------------------------------------------------------
    console.log(
      `[АНАЛІТИКА 🧠] 2. Перевірка на внутрішні конфлікти документа...`,
    );

    if (
      fromFilename.detectedSubject &&
      fromContent.detectedSubject &&
      fromFilename.detectedSubject !== fromContent.detectedSubject
    ) {
      throw new Error(
        `🚨 Критичний конфлікт документа! Назва файлу вказує на предмет "${fromFilename.detectedSubject}", але всередині сторінок виявлено текст предмета "${fromContent.detectedSubject}". Перевірте правильність файлу!`,
      );
    }

    if (
      fromFilename.detectedClass &&
      fromContent.detectedClass &&
      fromFilename.detectedClass !== fromContent.detectedClass
    ) {
      throw new Error(
        `🚨 Критичний конфлікт класів! Назва файлу належить до ${fromFilename.detectedClass}-го класу, а вміст сторінок вказує на ${fromContent.detectedClass}-й клас!`,
      );
    }

    if (!finalDetectedClass && !finalDetectedSubject) {
      console.log(
        "⚠️ Жодних маркерів НУШ не виявлено в жодному датчику. Тимчасово довіряємо кабінету.",
      );
      finalDetectedClass = schoolClass;
      finalDetectedSubject = expectedSubjectName;
    }

    // --------------------------------------------------------
    // КРОК 3: ФІНАЛЬНЕ ПОРІВНЯННЯ З МЕТАДАННИМИ КАБІНЕТУ ВЧИТЕЛЯ
    // --------------------------------------------------------
    console.log(
      `[АНАЛІТИКА 🎯] 3. Виклик універсального валідатора кабінету НУШ...`,
    );
    validateNushMetadata(
      {
        detectedClass: finalDetectedClass || 0,
        detectedSubject: finalDetectedSubject || "Предмет НУШ",
      },
      schoolClass,
      expectedSubjectName,
    );
    console.log(
      "✅ [АНАЛІТИКА УСПІШНА] Підручник повністю пройшов контроль кабінету.",
    );

    // --------------------------------------------------------
    // КРОК 4: СКЛАДНА ДЕДУПЛІКАЦІЯ ПО ПРОГРАМАМ ТА СТВОРЕННЯ КЛОНІВ
    // --------------------------------------------------------
    console.log(
      `[АНАЛІТИКА 🧱] 4. Перевірка бази даних Supabase на дублікати за хешем...`,
    );
    const duplicateResult = await checkFileHashOnly(supabase, {
      fileHash,
      subjectId,
      schoolClass,
      programId,
    });

    if (duplicateResult.isDuplicate) {
      console.log(
        "🎯 [ДЕДУПЛІКАЦІЯ УСПІХ] Книгу знайдено й успішно підключено! Пайплайн завершено.",
      );
      return {
        success: true,
        status: "DUPLICATE",
        data: duplicateResult.data,
      };
    }

    // Якщо все ідеально, книга унікальна і кабінет збігається — просто повертаємо статус VALIDATED
    // Хмару R2 та Ламу на цьому етапі взагалі не чіпаємо!
    console.log(
      "🎉 [УСПІХ] Усі перевірки пройдені! Файл готовий до наступного кроку хмари.",
    );
    return {
      success: true,
      status: "VALIDATED",
      fileName: originalName,
      detectedYear: finalDetectedYear,
    };
  } catch (error: any) {
    console.error("❌ [ЗБІЙ ЛАНЦЮЖОКА ПЕРЕВІРОК]:", error.message);
    const isValidationError =
      error.message?.includes("🚨") || error.message?.includes("конфлікт");
    return {
      success: false,
      status: "PROCESSING",
      error: error.message || "Помилка валідації підручника.",
      statusCode: isValidationError ? 422 : 500,
    };
  }
}

/**
 * 🛫 ЕКШЕН 2: ГЕНЕРАЦІЯ ТОКЕНУ CLOUDFLARE R2
 * Викликається тільки після того, як перший екшен повернув статус "VALIDATED"
 */
export async function generatePresignedR2UrlAction(
  originalName: string,
): Promise<{
  success: boolean;
  uploadUrl?: string;
  fileKey?: string;
  error?: string;
}> {
  try {
    console.log(
      `[ФЛОУ R2 🔗] Створення підписаного лінку через канонічний r2Client...`,
    );
    const fileKey = `textbooks/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.pdf`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: "application/pdf",
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 });
    return { success: true, uploadUrl, fileKey };
  } catch (err: any) {
    console.error("❌ Помилка R2:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 📡 ЕКШЕН 3: АСИНХРОННИЙ ТРИГЕР ДЛЯ LLAMAPARSE BY URL
 */
export async function startLlamaParsingAction(
  fileUrl: string,
  fileName: string,
) {
  try {
    return await uploadBookToLlamaCloudViaUrl(fileUrl, fileName);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 🔄 ЕКШЕН 4: SERVER ACTION ОПИТУВАННЯ ЧЕРГИ ТА ФІНАЛЬНИЙ КОММІТ В БД
 */
export async function checkLlamaStatusAndCommitAction(
  params: NewCheckStatusParams,
) {
  try {
    const supabaseAdmin = await createAdminServerConnection();
    const parseResult = (await getLlamaParsingResult(params.jobId)) as any;

    const currentStatus = parseResult?.status || "";
    const pages = parseResult?.markdown?.pages || [];

    console.log(
      `📡 [LAMA STATUS]: "${currentStatus}" | Сторінок: ${pages.length}`,
    );

    if (currentStatus !== "SUCCESS" && pages.length === 0) {
      if (currentStatus === "FAILED" || currentStatus === "ERROR") {
        throw new Error(`LlamaCloud повернув помилку: ${currentStatus}`);
      }
      return { success: true, status: "PROCESSING" };
    }

    const rawMarkdown = pages
      .map((page: any) => page?.markdown || "")
      .join("\n");
    if (!rawMarkdown || rawMarkdown.trim().length < 10) {
      throw new Error("Спарсений текст підручника порожній.");
    }

    const llamaCoverUrl =
      parseResult?.file_url ||
      parseResult?.cover_image_url ||
      "/images/default-book-cover.png";

    const finalBook = await createBookAndStreamContentsToR2(supabaseAdmin, {
      rawMarkdown,
      fileName: params.fileName,
      fileHash: params.fileHash,
      subjectId: params.subjectId,
      schoolClass: params.schoolClass,
      programId: params.programId,
      publishingYear: params.detectedYear,
      fileKey: params.fileKey,
      llamaCoverUrl,
    });

    return { success: true, status: "COMPLETED", data: finalBook };
  } catch (error: any) {
    console.error("❌ [ПОМИЛКА ЕТАПУ 2]:", error.message);
    return { success: false, error: error.message };
  }
}

export async function getSubjectsByChild(
  schoolClass: number,
  programId: string | null,
) {
  try {
    if (!programId) return { success: true, data: [] };
    const supabase = await createAdminServerConnection();

    const { data, error } = await supabase
      .from("program_subjects")
      .select("id, subject_name, program_id, school_class")
      .eq("school_class", schoolClass)
      .eq("program_id", programId)
      .order("subject_name", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Помилка в getSubjectsByChild:", error.message);
    return { success: false, error: error.message, data: [] };
  }
}

// 📂 Шлях до файлу: app/dashboard/actions.ts

export async function getBooksBySubject(
  subjectId: string,
  schoolClass: number,
) {
  try {
    const supabase = await createAdminServerConnection();
    const { data, error } = await supabase
      .from("books")
      .select("id, title, publisher, publishing_year")
      .eq("subject_id", subjectId)
      .eq("school_class", schoolClass)
      .order("title", { ascending: true });

    if (error) throw error;
    return { success: true, data: (data as BookData[]) || [] };
  } catch (error: any) {
    console.error("Помилка in getBooksBySubject:", error.message);
    return { success: false, error: error.message, data: [] };
  }
}

export async function getParagraphsByBook(bookId: string) {
  try {
    const supabase = await createAdminServerConnection();
    const { data, error } = await supabase
      .from("book_contents")
      .select("id, book_id, chapter_title, paragraph_number, raw_text")
      .eq("book_id", bookId)
      .order("paragraph_number", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("❌ Помилка getParagraphsByBook:", error.message);
    return { success: false, error: error.message, data: [] };
  }
}

export async function adaptMaterialAction(params: AdaptTextParams) {
  try {
    const supabase = await createAdminServerConnection();

    const realOriginalText = params.text.startsWith("sources/")
      ? await downloadTextFromR2(params.text)
      : params.text;

    if (!realOriginalText || realOriginalText.trim().length < 5) {
      throw new Error("Вхідний текст параграфа порожній.");
    }

    const aiResult = (await runTextAdaptationPipeline({
      text: realOriginalText,
      userId: params.userId,
      userRole: params.userRole,
      subjectName: params.subjectName,
      contentType: params.contentType,
      clientChildData: params.clientChildData,
    })) as any;

    const adaptedR2Key = `adapted-materials/${params.clientChildData.id}/${Date.now()}-${params.contentType}.md`;
    await uploadTextToR2(
      adaptedR2Key,
      aiResult.adaptedMarkdown || aiResult.text || "",
    );

    const { data: logRecord, error: dbErr } = await supabase
      .from("adaptation_logs")
      .insert({
        child_id: params.clientChildData.id,
        user_id: params.userId,
        subject_name: params.subjectName,
        content_type: params.contentType,
        original_text_pointer: params.text.startsWith("sources/")
          ? params.text
          : null,
        adapted_text_pointer: adaptedR2Key,
        tokens_used: aiResult.metadata?.tokensUsed || 0,
        adaptation_strategy_applied:
          aiResult.metadata?.strategyApplied || "default",
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    return {
      success: true,
      adaptedMarkdown: aiResult.adaptedMarkdown || aiResult.text || "",
      data: logRecord,
    };
  } catch (error: any) {
    console.error("❌ КРИТИЧНИЙ ЗБІЙ ШІ-АДАПТАЦІЇ В ЕКШЕНІ:", error.message);
    return {
      success: false,
      error: error.message,
      adaptedMarkdown: "",
      data: null,
    };
  }
}
