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
// app/dashboard/upload/actions.ts

/**
 * 🛡️ ЛОКАЛЬНИЙ ЕКШЕН 1: СУВОРИЙ СЕРВЕРНИЙ КОНВЕЄР ПЕРЕВІРОК НУШ
 * 🔥 СУВОРА ЧЕРГОВІСТЬ: Датчик імені ➡️ Датчик вмісту ➡️ Перехресний конфлікт ➡️ Контроль кабінету ➡️ ТІЛЬКИ ТЕПЕР ХЕШ
 */
// app/dashboard/upload/actions.ts

/**
 * 🛡️ ЛОКАЛЬНИЙ ЕКШЕН 1: СУВОРИЙ СЕРВЕРНИЙ КОНВЕЄР ПЕРЕВІРОК З ТОТАЛЬНИМ ЛОГУВАННЯМ
 */
export async function verifyBookMetadataAction(
  formData: FormData,
): Promise<InitializeUploadResponse> {
  console.log("\n=======================================================");
  console.log("🔍 [DIAGNOSTIC CONVOY] СТАРТ ТОТАЛЬНОГО АНАЛІЗУ КНИГИ");
  console.log("=======================================================");

  try {
    const supabase = await createAdminServerConnection();

    const miniPreviewFile = formData.get("file") as File;
    const originalName = formData.get("originalName") as string;
    const fileHash = formData.get("fileHash") as string;
    const subjectId = formData.get("subjectId") as string;
    const schoolClass = Number(formData.get("schoolClass"));
    const expectedSubjectName =
      (formData.get("subjectName") as string) || "Предмет НУШ";
    const programId = (formData.get("programId") as string) || null;

    console.log("📥 [ВХІДНІ ДАНІ КАБІНЕТУ]:");
    console.log(`   - Назва файлу: "${originalName}"`);
    console.log(`   - Обраний Клас: ${schoolClass}`);
    console.log(
      `   - Обраний Предмет: "${expectedSubjectName}" (ID: ${subjectId})`,
    );
    console.log(`   - Хеш файлу: ${fileHash}`);

    if (!miniPreviewFile || !fileHash || !originalName) {
      return {
        success: false,
        status: "PROCESSING",
        error: "Критичні дані файлу відсутні.",
        statusCode: 400,
      };
    }

    // --------------------------------------------------------
    // 🎚️ КРОК 1: АНАЛІЗ ІМЕНІ ФАЙЛУ
    // --------------------------------------------------------
    console.log("\n[ДАТЧИК 1] -> Аналіз імені файлу...");
    const fromFilename = parseMetadataFromFilename(originalName);
    console.log("   [РЕЗУЛЬТАТ ІМЕНІ]:", JSON.stringify(fromFilename, null, 2));

    // --------------------------------------------------------
    // 🎚️ КРОК 2: АНАЛІЗ ВНУТРІШНЬОГО ТЕКСТУ PDF (5 СТОРІНОК)
    // --------------------------------------------------------
    console.log("\n[ДАТЧИК 2] -> Чистий витяг тексту з 5 сторінок прев'ю...");
    const fromContent = await parsePdfTitlePage(miniPreviewFile, fileHash);
    console.log(
      "   [РЕЗУЛЬТАТ ТЕКСТУ PDF]:",
      JSON.stringify(fromContent, null, 2),
    );

    // --------------------------------------------------------
    // 🎚️ КРОК 3: ПЕРЕХРЕСНЕ ПОРІВНЯННЯ ДАТЧИКІВ МІЖ СОБОЮ
    // --------------------------------------------------------
    console.log(
      "\n[ПОРІВНЯННЯ 🧠] Крок 3. Пошук конфліктів у самому файлі (Ім'я vs Вміст)...",
    );
    console.log(
      `   - Ім'я каже предмет: "${fromFilename.detectedSubject}", Текст каже: "${fromContent.detectedSubject}"`,
    );
    console.log(
      `   - Ім'я каже клас: ${fromFilename.detectedClass}, Текст каже: ${fromContent.detectedClass}`,
    );

    if (
      fromFilename.detectedSubject &&
      fromContent.detectedSubject &&
      fromFilename.detectedSubject !== fromContent.detectedSubject
    ) {
      console.log("❌ [КРИТИЧНИЙ КОНФЛІКТ ПРЕДМЕТІВ ВИЯВЛЕНО ВСЕРЕДИНІ ФАЙЛУ]");
      throw new Error(
        `🚨 Помилка відповідності файлу! Назва файлу вказує на предмет "${fromFilename.detectedSubject}", але всередині сторінок виявлено текст предмета "${fromContent.detectedSubject}".`,
      );
    }

    if (
      fromFilename.detectedClass &&
      fromContent.detectedClass &&
      fromFilename.detectedClass !== fromContent.detectedClass
    ) {
      console.log("❌ [КРИТИЧНИЙ КОНФЛІКТ КЛАСІВ ВИЯВЛЕНО ВСЕРЕДИНІ ФАЙЛУ]");
      throw new Error(
        `🚨 Помилка відповідності класів! Назва файлу належить до ${fromFilename.detectedClass}-го класу, а вміст сторінок вказує на ${fromContent.detectedClass}-й клас!`,
      );
    }

    // Зведення легітимних значень
    const finalDetectedClass: number =
      fromContent.detectedClass || fromFilename.detectedClass || schoolClass;
    const finalDetectedSubject: string =
      fromContent.detectedSubject ||
      fromFilename.detectedSubject ||
      expectedSubjectName;
    const finalDetectedYear =
      fromContent.detectedYear ||
      fromFilename.detectedYear ||
      new Date().getFullYear();

    console.log(
      "\n[ЗВЕДЕННЯ 📊] Легітимні маркери, які система прийняла за істину:",
    );
    console.log(`   - Підсумковий Клас: ${finalDetectedClass}`);
    console.log(`   - Підсумковий Предмет: "${finalDetectedSubject}"`);
    console.log(`   - Підсумковий Рік: ${finalDetectedYear}`);

    // --------------------------------------------------------
    // 🎚️ КРОК 4: ПОРІВНЯННЯ З КАБІНЕТОМ (ВЧИТЕЛЬСЬКИМИ СТЕЙТАМИ)
    // --------------------------------------------------------
    console.log(
      "\n[ВАЛІДАТОР 🎯] Крок 4. Перевірка відповідності поточному кабінету вчителя...",
    );
    console.log(
      `   - Порівнюємо Клас: прийнятий ${finalDetectedClass} vs очікуваний ${schoolClass}`,
    );
    console.log(
      `   - Порівнюємо Предмет: прийнятий "${finalDetectedSubject}" vs очікуваний "${expectedSubjectName}"`,
    );

    // Розрахунок універсального кореня предмета для логів
    const expectedLower = expectedSubjectName.toLowerCase().trim();
    const detectedLower = finalDetectedSubject.toLowerCase().trim();
    const subjectRoot = expectedLower
      .replace(/(ія|ика|а|ка|ографія|ематика)\$/, "")
      .slice(0, 5);
    const isSubjectMatch =
      detectedLower.includes(subjectRoot) ||
      expectedLower.includes(detectedLower) ||
      detectedLower.includes(expectedLower);

    console.log(
      `   - [ЛОГ КОРЕНЯ] Розрахований корінь кабінету: "${subjectRoot}". Чи є збіг: ${isSubjectMatch}`,
    );

    // Викликаємо твою оригінальну функцію валідації
    validateNushMetadata(
      {
        detectedClass: finalDetectedClass,
        detectedSubject: finalDetectedSubject,
      },
      schoolClass,
      expectedSubjectName,
    );
    console.log(
      "✅ [УСПІХ] Контроль кабінету пройдено! Книга відповідає дисципліні.",
    );

    // --------------------------------------------------------
    // 🎚️ КРОК 5: ПЕРЕВІРКА ХЕШУ В БАЗІ ДАНИХ (ДЕДУПЛІКАЦІЯ)
    // --------------------------------------------------------
    console.log(
      `\n[БАЗА ДАНИХ 🧱] Крок 5. Опитування Supabase на наявність копій за хешем: ${fileHash}`,
    );
    const duplicateResult = await checkFileHashOnly(supabase, {
      fileHash,
      subjectId,
      schoolClass,
      programId,
    });

    console.log(
      "   [РЕЗУЛЬТАТ БАЗИ ДАНИХ]:",
      JSON.stringify(duplicateResult, null, 2),
    );

    if (duplicateResult.isDuplicate) {
      console.log(
        "🎯 [КОММІТ СКАСОВАНО] Дублікат залізобетонно знайдено. Повертаємо DUPLICATE.",
      );
      return {
        success: true,
        status: "DUPLICATE",
        data: duplicateResult.data,
      };
    }

    console.log(
      "🚀 [УНІКАЛЬНА КНИГА] Перевірки успішні, дублікатів немає. Дозволяємо R2!",
    );
    return {
      success: true,
      status: "VALIDATED",
      fileName: originalName,
      detectedYear: finalDetectedYear,
    };
  } catch (error: any) {
    console.error("\n❌ [🚨 КРИТИЧНИЙ ЗБІЙ НА ЛІНІЇ КОНВЕЄРА ПЕРЕВІРОК]:");
    console.error(`   Повідомлення про помилку: "${error.message}"`);

    const isValidationError =
      error.message?.includes("🚨") ||
      error.message?.includes("Помилка") ||
      error.message?.includes("відповідності");
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
// app/dashboard/upload/actions.ts

/**
 * 🛫 ЕКШЕН 2: ГЕНЕРАЦІЯ ТОКЕНУ CLOUDFLARE R2
 * Повертаємо суворо 1 вхідний аргумент, як це було від початку!
 */
// app/dashboard/upload/actions.ts

export async function generatePresignedR2UrlAction(
  originalName: string,
  fileHash: string, // 🔥 Використовуємо готовий хеш книги
): Promise<{
  success: boolean;
  uploadUrl?: string;
  fileKey?: string;
  error?: string;
}> {
  try {
    console.log(
      `[ФЛОУ R2 🔗] Створення фіксованого лінку для хешу: ${fileHash}`,
    );

    // 🔥 ЗАМІСТЬ DATE.NOW ТА RANDOM: називаємо файл його унікальним SHA-256 відбитком
    // Завдяки цьому посилання на той самий підручник ЗАВЖДИ буде ідентичним!
    const fileKey = `books/source-pdf/${fileHash}.pdf`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: "application/pdf",
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    return { success: true, uploadUrl, fileKey };
  } catch (error: any) {
    console.error("❌ [R2 PRESIGNED GENERATION ERROR]:", error.message);
    return { success: false, error: "Не вдалося згенерувати токен доступу." };
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
