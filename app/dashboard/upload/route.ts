// 📂 Шлях до файлу: app/dashboard/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminServerConnection } from "@/app/utils/supabase/server";
// ✨ Імпортуємо правильну, нову поєднану назву функції з хелперів!
import {
  checkFileHashOnly,
  parsePdfTitlePage,
  validateNushMetadata,
} from "@/app/utils/supabase/upload-helpers";
import LlamaCloud from "@llamaindex/llama-cloud";

export const maxDuration = 900;

const llamaClient = new LlamaCloud({ apiKey: process.env.LLAMA_CLOUD_API_KEY });

/**
 * 🛫 ЕТАП 1: ПОСЛІДОВНИЙ ПРИЙОМ, АНТИБЛОК ТА КРОС-ВАЛІДАЦІЯ ДО ШІ
 */
export async function POST(request: NextRequest) {
  console.log("\n=======================================================");
  console.log("📥 [API-РОУТ] ЕТАП 1: ПОТОКОВИЙ ПРИЙОМ ТА КРОС-ВАЛІДАЦІЯ");
  console.log("=======================================================");

  try {
    const supabase = await createAdminServerConnection();

    // Зчитуємо Multipart FormData та всі стейти кабінету вчителя
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileHash = formData.get("fileHash") as string;
    const subjectId = formData.get("subjectId") as string;
    const schoolClass = Number(formData.get("schoolClass"));
    const programId = (formData.get("programId") as string) || null;
    const expectedSubjectName =
      (formData.get("subjectName") as string) || "Предмет НУШ";

    if (!file || !fileHash) {
      return NextResponse.json(
        { success: false, error: "Критична помилка: Файл або хеш відсутні." },
        { status: 400 },
      );
    }

    // ========================================================
    // 🧱 КРОК 1 (ЗАЛІЗНИЙ ЗАСЛОН): ПЕРЕВІРКА ХЕШУ ТА ДУБЛІВ ПРОГРАМИ
    // ========================================================
    // Викликається найпершою. Якщо книга вже є в цій програмі — миттєвий вихід без інсертів!
    const duplicateResult = await checkFileHashOnly(supabase, {
      fileHash,
      subjectId,
      schoolClass,
      programId,
    });

    if (duplicateResult.isDuplicate) {
      console.log(
        "🎯 [ДЕДУПЛІКАЦІЯ] Книгу успішно розпізнано. Зупиняємо пайплайн.",
      );
      return NextResponse.json({
        success: true,
        status: "DUPLICATE",
        data: duplicateResult.data,
      });
    }
    // 📂 Фінал файлу: app/dashboard/upload/route.ts

    // ========================================================
    // 📄 КРОК 2: АКТ ТЕХНІЧНОГО ВИЛУЧЕННЯ МЕТАДАНИХ (СТOРІНКИ 2-3)
    // ========================================================
    // Працює миттєво за 150мс, повністю зносячи ризики будь-яких таймаутів!
    const pdfMeta = await parsePdfTitlePage(
      file,
      fileHash,
      expectedSubjectName,
    );
    console.log(
      `📄 Аналіз виконано. Знайдено рік: ${pdfMeta.detectedYear}, клас: ${pdfMeta.detectedClass}`,
    );

    // ========================================================
    // 🛡️ КРОК 3: СУВOРИЙ КРОС-ФІЛЬТР БІЗНЕС-ПРAВИЛ ВІДПОВІДНОСТІ
    // ========================================================
    // Порівнює витягнуті дані з кабінетом. Кидає жорсткий Error ДО надсилання в ШІ!
    validateNushMetadata(
      {
        detectedClass: pdfMeta.detectedClass,
        detectedSubject: pdfMeta.detectedSubject,
      },
      schoolClass,
      expectedSubjectName,
    );
    console.log(
      "✅ Крос-валідація успішна! Файл повністю відповідає дисципліні кабінету.",
    );

    // ========================================================
    // 🚀 КРОК 4: МИТТЄВА РЕЄСТРАЦІЯ ТАСКУ В LLAMACLOUD ЗА SDK
    // ========================================================
    console.log("⏳ Перетворення потоку в бінарний Buffer для LlamaCloud...");
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
      `✅ [ЛАМА] Таск успішно активовано у хмарі! Llama File ID: ${fileResponse.id}`,
    );

    // Повертаємо виловлений рік далі на Етап 2. Обкладинка згенерується у фоні на Етапі 2!
    return NextResponse.json({
      success: true,
      status: "PROCESSING",
      llamaFileId: fileResponse.id,
      fileName: file.name,
      fileHash,
      detectedYear: pdfMeta.detectedYear,
    });
  } catch (error: any) {
    console.error(
      "❌ КРИТИЧНА ПОМИЛКА НА ЕТАПІ ІНІЦІАЛІЗАЦІЇ 1:",
      error.message,
    );
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Помилка ініціалізації підручника.",
      },
      { status: error.message?.includes("не збігається") ? 422 : 500 },
    );
  }
}
