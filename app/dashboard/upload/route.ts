import { NextRequest, NextResponse } from "next/server";
import { createServerConnection } from "@/app/utils/supabase/server";
import { parseNewBookWithAI } from "@/app/utils/r2/parser-helper";
import { generateSourceKey } from "@/app/utils/r2/naming";

export async function POST(request: NextRequest) {
  console.log("\n=======================================================");
  console.log("📥 [API-РОУТ] СЕРВЕР ПРИЙНЯВ БІНАРНИЙ PDF-ФАЙЛ ПОТОКОМ");
  console.log("=======================================================");

  try {
    const supabase = await createServerConnection();

    // 1. Зчитуємо Multipart FormData (чисті бінарні дані без Base64 на клієнті)
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const subjectId = formData.get("subjectId") as string;
    const schoolClass = Number(formData.get("schoolClass"));
    const programId = (formData.get("programId") as string) || null;
    const fileHash = formData.get("fileHash") as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Файл не знайдено." },
        { status: 400 },
      );
    }

    console.log(`📄 Обробка підручника: ${file.name}`);
    console.log(
      `⚖️ Реальний розмір файлу: ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    );

    // 2. ЕКОЛОГІЯ СХОВИЩА: Конвертуємо файл у буфер ТІЛЬКИ для передачі в ШІ-парсер
    // Жодних важких завантажень оригіналів PDF у Cloudflare R2 більше немає!
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Перетворюємо буфер у Base64 як тимчасовий токен для передачі в LlamaParse API
    const fileBase64 = buffer.toString("base64");

    // 4. Передаємо дані у наше живе ШІ-ядро з логами
    const aiParsedResult = await parseNewBookWithAI(
      fileHash,
      fileBase64,
      file.name,
    );

    // 5. Записуємо головну картку книги у таблицю `books` через Supabase
    console.log("⏳ Створення запису книги в базі даних Supabase...");
    const { data: newBook, error: insertError } = await supabase
      .from("books")
      .insert({
        title: aiParsedResult.title || file.name.replace(".pdf", ""),
        publisher: aiParsedResult.publisher,
        publishing_year: aiParsedResult.publishing_year,
        subject_id: subjectId,
        school_class: schoolClass,
        program_id: programId,
        file_hash: fileHash,
      })
      .select("id, title, publisher, publishing_year")
      .single();

    if (insertError) throw insertError;
    console.log(`✅ Книгу успішно додано в базу. ID: ${newBook.id}`);

    // 6. Автоматично розкладаємо отримані параграфи в таблицю `book_contents`
    if (aiParsedResult.chapters && aiParsedResult.chapters.length > 0) {
      console.log(
        `⏳ Запис параграфів у базу даних (Всього глав: ${aiParsedResult.chapters.length})...`,
      );
      const contentRows: any[] = [];

      aiParsedResult.chapters.forEach((chapter: any) => {
        if (chapter.paragraphs && chapter.paragraphs.length > 0) {
          chapter.paragraphs.forEach((paragraphNum: any) => {
            const r2Key = generateSourceKey({
              programId: programId || "unknown_program",
              schoolClass: schoolClass,
              subjectId: subjectId,
              author: aiParsedResult.publisher || "author",
              year: aiParsedResult.publishing_year || new Date().getFullYear(),
              paragraphNumber: paragraphNum,
            });

            contentRows.push({
              book_id: newBook.id,
              chapter_title: chapter.title,
              paragraph_number: paragraphNum,
              raw_text: r2Key, // Шлях до майбутнього текстового файлу параграфа
            });
          });
        }
      });

      if (contentRows.length > 0) {
        const { error: contentError } = await supabase
          .from("book_contents")
          .insert(contentRows);
        if (contentError)
          console.error("⚠️ Помилка запису параграфів:", contentError.message);
      }
    }

    console.log("🎯 [ФІНІШ] ПІДРУЧНИК ПОВНІСТЮ ОБРОБЛЕНО ТА ЗБЕРЕЖЕНО!");
    return NextResponse.json({
      success: true,
      isDuplicate: false,
      data: newBook,
    });
  } catch (error: any) {
    console.error(
      "❌ КРИТИЧНА ПОМИЛКА В API-РОУТІ ЗАВАНТАЖЕННЯ:",
      error.message,
    );
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// 🌟 ЗБІЛЬШУЄМО ЧАС ЖИТТЯ ЗАПИТУ ДО 15 ХВИЛИН ДЛЯ ВЕЛИКИХ ПІДРУЧНИКІВ
export const maxDuration = 900; // 900 секунд = 15 хвилин
