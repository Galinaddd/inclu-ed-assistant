// 📂 Шлях до файлу: app/dashboard/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminServerConnection } from "@/app/utils/supabase/server";
import {
  parseMetadataFromFilename,
  validateNushMetadata,
  parsePdfTitlePage,
  checkFileHashOnly,
} from "@/app/utils/supabase/upload-helpers";

import { uploadBookToLlamaCloudViaUrl } from "@/app/utils/ai/llama-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 🛫 ОНОВЛЕНИЙ ДВОЕТАПНИЙ МОНОЛІТНИЙ РОУТ
 * Етап 1 (Без fileKey): Чиста валідація кабінету та дедуплікація хешу.
 * Етап 2 (З fileKey): Швидкий транзит схваленого бінарника з R2 в Llama Cloud.
 */
export async function POST(request: NextRequest) {
  console.log("\n=======================================================");
  console.log("📥 [API-РОУТ] ОБРОБКА КРОКУ КОНВЕЄРА ПЕРЕВІРОК ТА ШІ");
  console.log("=======================================================");

  try {
    const supabase = await createAdminServerConnection();
    const formData = await request.formData();

    const miniPreviewFile = formData.get("file") as File;
    const originalName =
      (formData.get("originalName") as string) ||
      (miniPreviewFile ? miniPreviewFile.name : "book.pdf");
    const fileHash = formData.get("fileHash") as string;
    const subjectId = formData.get("subjectId") as string;
    const schoolClass = Number(formData.get("schoolClass"));
    const expectedSubjectName =
      (formData.get("subjectName") as string) || "Предмет НУШ";
    const programId = (formData.get("programId") as string) || null;

    // Дістаємо ключ R2 (якщо він є)
    const clientFileKey = formData.get("fileKey") as string;

    // 🔥 РOЗДІЛЕННЯ НА ДВА ЧИСТИХ ФЛОУ:

    // ========================================================
    // 🚀 ФЛОУ Б: РЕЄСТРАЦІЯ ОРИГІНАЛУ В ШІ (Коли fileKey вже є)
    // ========================================================
    if (clientFileKey) {
      console.log(
        "⏳ [РОУТ 🚀] Етап 2: Транзит перевіреного оригінального файлу з R2 в ШІ Llama Cloud...",
      );
      const r2PublicDomain =
        process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN ||
        `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
      const r2PublicUrl = `${r2PublicDomain}/${clientFileKey}`;

      console.log(`🔗 Стягуємо байти для ШІ: ${r2PublicUrl}`);
      const r2Response = await fetch(r2PublicUrl);
      if (!r2Response.ok)
        throw new Error(
          `Не вдалося прочитати оригінал з R2 за ключем ${clientFileKey}.`,
        );

      const arrayBuffer = await r2Response.arrayBuffer();
      const nodeBuffer = Buffer.from(arrayBuffer);

      const llamaResult = await uploadBookToLlamaCloudViaUrl(
        nodeBuffer,
        originalName,
      );
      if (!llamaResult.success || !llamaResult.jobId) {
        throw new Error(
          `Помилка реєстрації підручника в ШІ Llama Cloud: ${llamaResult.error || "Невідомий збій SDK"}`,
        );
      }

      console.log(
        `✅ [УСПІХ ШІ] Завдання зареєстровано! LAMA JOB ID: ${llamaResult.jobId}`,
      );
      return NextResponse.json({
        success: true,
        status: "PROCESSING",
        llamaFileId: llamaResult.jobId,
      });
    }

    // ========================================================
    // 🛡️ ФЛОУ А: ПЕРШOЧЕРГОВА СУВOРА ВАЛІДАЦІЯ (Коли fileKey ще немає)
    // ========================================================
    if (!miniPreviewFile || !fileHash) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Критичні дані файлу (preview або fileHash) відсутні для валідації.",
        },
        { status: 400 },
      );
    }

    console.log(`[РОУТ 🔍] Крок 1. Аналіз імені файлу: "${originalName}"`);
    const fromFilename = parseMetadataFromFilename(originalName);
    console.log("fromFilename", fromFilename);

    // --------------------------------------------------------
    // 🎚️ ЕТАП 2: ЗАЛІЗОБЕТОННЕ ЗЧИТУВАННЯ ТЕКСТУ ПРЕВ'Ю PDF
    // --------------------------------------------------------
    // --------------------------------------------------------
    // 🎚️ ЕТАП 2: ЗАЛІЗОБЕТОННЕ ЗЧИТУВАННЯ ТЕКСТУ ПРЕВ'Ю PDF
    // --------------------------------------------------------
    console.log(
      `[РОУТ 🔍] Крок 2. Чистий витяг тексту з перших сторінок прев'ю...`,
    );

    const clientArrayBuffer = await miniPreviewFile.arrayBuffer();
    const serverNodeBuffer = Buffer.from(clientArrayBuffer);

    // 🔥 ГЕНІАЛЬНЕ ВИПРАВЛЕННЯ: Передаємо реальну оригінальну назву книги (наприклад, "1.pdf" чи "english-5.pdf")
    // Завдяки цьому фільтр захисту всередині parsePdfTitlePage знову почне працювати на 100%!
    const safeServerFile = new File([serverNodeBuffer], originalName, {
      type: "application/pdf",
    });

    // 🔥 ОНОВЛЕНО: Передаємо у датчик саме наш безпечний safeServerFile з оригінальним ім'ям!
    const fromContent = await parsePdfTitlePage(safeServerFile, fileHash);

    console.log(`fromContent`, fromContent);

    console.log(
      `[РОУТ 🧠] Крок 3. Перехресне порівняння маркерів імені та вмісту...`,
    );
    if (
      fromFilename.detectedSubject &&
      fromContent.detectedSubject &&
      fromFilename.detectedSubject !== fromContent.detectedSubject
    ) {
      throw new Error(
        `🚨 Помилка відповідності файлу! Назва файлу вказує на предмет "${fromFilename.detectedSubject}", але всередині сторінок виявлено текст предмета "${fromContent.detectedSubject}".`,
      );
    }

    // Зведення легітимних значень
    const finalDetectedClass: number =
      fromContent.detectedClass || fromFilename.detectedClass || schoolClass;
    const finalDetectedSubject: string =
      fromContent.detectedSubject ||
      fromFilename.detectedSubject ||
      "Невідомий предмет";
    const finalDetectedYear =
      fromContent.detectedYear ||
      fromFilename.detectedYear ||
      new Date().getFullYear();

    console.log(
      `📊 [АНАЛІЗ ЗАВЕРШЕНО] Реально знайдені маркери файлу -> Клас: ${finalDetectedClass}, Предмет: "${finalDetectedSubject}"`,
    );

    console.log(
      `[РОУТ 🎯] Крок 4. Перевірка відповідності поточному кабінету вчителя НУШ...`,
    );
    validateNushMetadata(
      {
        detectedClass: finalDetectedClass,
        detectedSubject: finalDetectedSubject,
      },
      schoolClass,
      expectedSubjectName,
    );
    console.log(
      "✅ [ВАЛІДАЦІЯ УСПІШНА] Підручник повністю відповідає кабінету.",
    );

    console.log(
      `[РОУТ 🧱] Крок 5. Перевірка бази даних Supabase на наявність копій за хешем...`,
    );
    const duplicateResult = await checkFileHashOnly(supabase, {
      fileHash,
      subjectId,
      schoolClass,
      programId,
    });

    if (duplicateResult.isDuplicate) {
      console.log(
        "🎯 [ДЕДУПЛІКАЦІЯ УСПІХ] Хеш знайдено! Повертаємо DUPLICATE.",
      );
      return NextResponse.json({
        success: true,
        status: "DUPLICATE",
        data: duplicateResult.data,
      });
    }

    // Книга пройшла контроль, унікальна і готова до завантаження в R2!
    console.log(
      "🚀 [ВАЛІДАЦІЯ ДОЗВОЛЕНА] Книга легітимна та нова. Дозволяємо модалці йти в R2 хмару.",
    );
    return NextResponse.json({
      success: true,
      status: "VALIDATED",
      detectedYear: finalDetectedYear,
    });
  } catch (error: any) {
    console.error("❌ [КРИТИЧНИЙ ЗБІЙ КОНВЕЄРА РОУТУ]:", error.message);
    const isValidationError =
      error.message?.includes("🚨") ||
      error.message?.includes("конфлікт") ||
      error.message?.includes("Помилка") ||
      error.message?.includes("відповідності");
    return NextResponse.json(
      { success: false, error: error.message || "Помилка обробки на сервері." },
      { status: isValidationError ? 422 : 500 },
    );
  }
}
