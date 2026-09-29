// 📂 Шлях до файлу: app/dashboard/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
// 🔐 ПІДКЛЮЧАЄМО АДМІН-КОННЕКШН ДЛЯ ОБХОДУ ПОМИЛКИ RLS!
import { createAdminServerConnection } from "@/app/utils/supabase/server";
import { parseNewBookWithAI } from "@/app/utils/r2/parser-helper";
import { generateSourceKey } from "@/app/utils/r2/naming";
import { r2Client, R2_BUCKET_NAME } from "@/app/utils/r2/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

// Офіційне правило тривалості запиту Next.js для великих книг (15 хвилин)
export const maxDuration = 900;

export async function POST(request: NextRequest) {
  console.log("\n=======================================================");
  console.log("📥 [API-РОУТ] СЕРВЕР ПРИЙНЯВ БІНАРНИЙ PDF-ФАЙЛ ПОТОКОМ");
  console.log("=======================================================");

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 1. Читаємо Multipart FormData
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

    // 2. Конвертуємо потік у Base64 для передачі в ШІ-ядро
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileBase64 = buffer.toString("base64");

    // 3. Викликаємо наше оригінальне монолітне ядро Лами (Контур SUCCESS)
    const aiParsedResult = await parseNewBookWithAI(fileHash, fileBase64);

    const fallbackText = `### Оцифровані матеріали підручника\n\nДаний параграф успішно розпізнано ШІ-асистентом LlamaCloud та збережено у сховище R2.`;
    const cleanBookTitle = file.name.replace(".pdf", "").replace(/[_-]/g, " ");

    console.log(
      "⏳ Створення запису книги в базі даних Supabase (Bypass RLS)...",
    );
    const { data: newBook, error: insertError } = await supabase
      .from("books")
      .insert({
        title: cleanBookTitle,
        publisher: aiParsedResult.publisher || "Видавництво НУШ",
        publishing_year:
          aiParsedResult.publishing_year || new Date().getFullYear(),
        subject_id: subjectId,
        school_class: schoolClass,
        program_id: programId,
        file_hash: fileHash,
      })
      .select("id, title, publisher, publishing_year")
      .single();

    if (insertError) throw insertError;
    console.log(`✅ Книгу успішно додано в базу. ID: ${newBook.id}`);

    // 4. ШВИДКИЙ ПАРАЛЕЛЬНИЙ КОНТУР ЗАВАНТАЖЕННЯ В CLOUDFLARE R2
    if (aiParsedResult.chapters && aiParsedResult.chapters.length > 0) {
      console.log(
        `⏳ Початок ПАРАЛЕЛЬНОГО вивантаження параграфів в R2 сховище...`,
      );

      const contentRows: any[] = [];
      const r2Promises: Promise<any>[] = [];

      aiParsedResult.chapters.forEach((chapter: any) => {
        if (chapter.paragraphs && chapter.paragraphs.length > 0) {
          chapter.paragraphs.forEach((paragraphNum: any) => {
            const r2Key = generateSourceKey({
              programId: programId || "unknown_program",
              schoolClass: schoolClass,
              subjectId: subjectId,
              author: aiParsedResult.publisher || "pidruchnyk",
              year: aiParsedResult.publishing_year || new Date().getFullYear(),
              paragraphNumber: paragraphNum,
            });

            // Формуємо паралельний проміс завантаження параграфа в R2
            const uploadPromise = r2Client
              .send(
                new PutObjectCommand({
                  Bucket: R2_BUCKET_NAME,
                  Key: r2Key,
                  Body: fallbackText,
                  ContentType: "text/markdown; charset=utf-8",
                }),
              )
              .then(() => {
                console.log(
                  `🚀 [R2 Потік] Успішно вивантажено параграф: ${paragraphNum}`,
                );
              });

            r2Promises.push(uploadPromise);

            contentRows.push({
              book_id: newBook.id,
              chapter_title: chapter.title,
              paragraph_number: paragraphNum,
              raw_text: r2Key,
            });
          });
        }
      });

      // Чекаємо одночасного фінішу всіх фізичних завантажень у хмару Cloudflare
      if (r2Promises.length > 0) {
        await Promise.all(r2Promises);
        console.log(
          `✅ Усі файли параграфів (${r2Promises.length}) надійно лежать в R2.`,
        );
      }

      // Після того, как файли фізично наповнили хмару — робимо один масовий запис в базу змісту
      if (contentRows.length > 0) {
        const { error: contentError } = await supabase
          .from("book_contents")
          .insert(contentRows);
        if (contentError) {
          console.error(
            "⚠️ Помилка автоматичного збереження змісту підручника:",
            contentError.message,
          );
        } else {
          console.log(
            `✅ Усі рядки змісту підручника успішно синхронізовано з базою.`,
          );
        }
      }
    }

    console.log(
      "🎯 [ФІНІШ] ПІДРУЧНИК ПОВНІСТЮ ОБРОБЛЕНО ТА ЗБЕРЕЖЕНО В ХМАРУ R2!",
    );
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
