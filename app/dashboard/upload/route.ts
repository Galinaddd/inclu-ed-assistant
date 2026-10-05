import { NextRequest, NextResponse } from "next/server";
import { createAdminServerConnection } from "@/app/utils/supabase/server";
import {
  checkFileHashOnly,
  parsePdfTitlePage,
  validateNushMetadata,
} from "@/app/utils/supabase/upload-helpers";

// 🔥 Імпортуємо твій рідний SDK хелпер для Лами
import { uploadBookToLlamaCloudViaUrl } from "@/app/utils/ai/llama-parser";

// Запобігаємо агресивному кешуванню Next.js для бінарних форм
export const dynamic = "force-dynamic";

// Дозволяємо тривале виконання для великих Enterprise підручників НУШ (до 5 хвилин)
export const maxDuration = 300;

/**
 * 🛫 ЕТАП 1: ЧИСТИЙ ДИСПЕТЧЕР ВАЛІДАЦІЇ, ДЕДУПЛІКАЦІЇ ТА ТРАНЗИТУ В ШІ
 * Флоу: Перевірка метаданих ➡️ Дедуплікація Supabase ➡️ Транзит байтів R2 в Llama Cloud через SDK
 */
export async function POST(request: NextRequest) {
  console.log("\n=======================================================");
  console.log(
    "📥 [API-РОУТ] СТАРТ АНАЛІТИЧНОГО ДИСПЕТЧЕРА ВАЛІДАЦІЇ ТА ТРАНЗИТУ",
  );
  console.log("=======================================================");

  try {
    const supabase = await createAdminServerConnection();
    const formData = await request.formData();

    // Отримуємо легке 5-сторінкове прев'ю, яке модалка нарізала для валідації
    const file = formData.get("file") as File;
    const originalName = (formData.get("originalName") as string) || file.name;
    const fileHash = formData.get("fileHash") as string;
    const subjectId = formData.get("subjectId") as string;
    const schoolClass = Number(formData.get("schoolClass"));
    const programId = (formData.get("programId") as string) || null;
    const expectedSubjectName =
      (formData.get("subjectName") as string) || "Предмет НУШ";

    // Дістаємо унікальний ключ файлу в R2, надісланий модалкою
    const clientFileKey = formData.get("fileKey") as string;
    if (!clientFileKey) {
      throw new Error("Клієнт не передав унікальний fileKey сховища R2.");
    }

    if (!file || !fileHash) {
      return NextResponse.json(
        {
          success: false,
          error: "Критичні дані файлу або цифровий відбиток відсутні.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // 🛡️ КРОК 1: ПЕРШOЧЕРГОВА ЛОКАЛЬНА КРОС-ВАЛІДАЦІЯ МЕТАДАНИХ PREVIEW
    // ========================================================
    console.log(`[ФЛОУ 🔍] Запуск датчиків розпізнавання структури PDF...`);

    const pdfMeta = await parsePdfTitlePage(file, fileHash);

    console.log(
      `📊 [АНАЛІЗ PDF] Виявлено -> Клас: ${pdfMeta.detectedClass}, Предмет: ${pdfMeta.detectedSubject}`,
    );

    // Перевірка на конфлікти класу та предмета НУШ
    validateNushMetadata(
      {
        detectedClass: pdfMeta.detectedClass || schoolClass,
        detectedSubject: pdfMeta.detectedSubject || expectedSubjectName,
      },
      schoolClass,
      expectedSubjectName,
    );
    console.log(
      "✅ [ВАЛІДАЦІЯ УСПІШНА] Підручник повністю пройшов контроль кабінету.",
    );

    // ========================================================
    // 🧱 КРОК 2: ПОШУК РОЗУМНИХ ДУБЛІКАТІВ ТА КЛОНІВ У БАЗІ SUPABASE
    // ========================================================
    console.log(
      `[ФЛОУ 🧱] Перевірка BAM даних Supabase на наявність копій за хешем...`,
    );
    const duplicateResult = await checkFileHashOnly(supabase, {
      fileHash,
      subjectId,
      schoolClass,
      programId,
    });

    if (duplicateResult.isDuplicate) {
      console.log(
        "🎯 [ДЕДУПЛІКАЦІЯ УСПІХ] Книгу розпізнано й підключено! Пайплайн ШІ скасовано.",
      );
      return NextResponse.json({
        success: true,
        status: "DUPLICATE",
        data: duplicateResult.data,
      });
    }

    // ========================================================
    // 🚀 КРОК 3: ЧИСТИЙ ТРАНЗИТНИЙ ПРИЙОМ З R2 В LLAMA CLOUD (ЧЕРЕЗ SDK)
    // ========================================================
    // ========================================================
    // 🚀 КРОК 3: ЧИСТИЙ ТРАНЗИТНИЙ ПРИЙОМ З R2 В LLAMA CLOUD
    // ========================================================
    console.log(
      "⏳ [ФЛОУ 🔗] Унікальна книга. Початок транзитного перенесення з R2 в ШІ...",
    );

    const r2PublicDomain =
      process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN ||
      `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;

    const r2PublicUrl = `${r2PublicDomain}/${clientFileKey}`;

    console.log(
      `🔗 Стягуємо байти оригінального підручника з R2 хмари: ${r2PublicUrl}`,
    );
    const r2Response = await fetch(r2PublicUrl);
    if (!r2Response.ok) {
      throw new Error(
        `Не вдалося прочитати оригінал з R2 сховища за шляхом (${clientFileKey}). Статус: ${r2Response.statusText}`,
      );
    }

    // Зчитуємо файл у Buffer
    const arrayBuffer = await r2Response.arrayBuffer();
    const nodeBuffer = Buffer.from(arrayBuffer);

    console.log(
      "⏳ Передаємо фізичний Buffer із правильним підписом метаданих...",
    );

    // 🔥 Викликаємо метод, передаючи чистий Node.js Buffer та оригінальне ім'я для підпису рядка
    const llamaResult = await uploadBookToLlamaCloudViaUrl(
      nodeBuffer,
      originalName,
    );

    if (!llamaResult.success || !llamaResult.jobId) {
      throw new Error(
        `Помилка реєстрації підручника в ШІ: ${llamaResult.error || "Невідомий збій SDK"}`,
      );
    }

    const finalJobId = llamaResult.jobId;

    console.log(
      `✅ [УСПІХ РОУТУ] Файл успішно прийнято Ламою! LAMA JOB ID: ${finalJobId}`,
    );

    const finalYear =
      pdfMeta.detectedYear && pdfMeta.detectedYear !== 1111
        ? pdfMeta.detectedYear
        : new Date().getFullYear();

    // Повертаємо PROCESSING та наш отриманий jobId у клієнтську модалку
    return NextResponse.json({
      success: true,
      status: "PROCESSING",
      llamaFileId: finalJobId,
      fileName: originalName,
      fileHash,
      detectedYear: finalYear,
      fileKey: clientFileKey,
    });
  } catch (error: any) {
    console.error("❌ [КРИТИЧНИЙ ЗБІЙ ПАЙПЛАЙНУ РОУТУ]:", error.message);

    const isValidationError =
      error.message?.includes("🚨") ||
      error.message?.includes("конфлікт") ||
      error.message?.includes("не збігається");

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Помилка обробки підручника на сервері.",
      },
      { status: isValidationError ? 422 : 500 },
    );
  }
}
