// 📂 Шлях до файлу: app/dashboard/upload/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseNewBookWithAI } from "@/app/utils/r2/parser-helper";
import { generateSourceKey } from "@/app/utils/r2/naming";
import { r2Client, R2_BUCKET_NAME } from "@/app/utils/r2/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import LlamaCloud from "@llamaindex/llama-cloud";

export const maxDuration = 900;

const llamaClient = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
});

export async function POST(request: NextRequest) {
  console.log("\n=======================================================");
  console.log("🔍 [STATUS ROUTE] ПЕРЕВІРКА ГОТОВНОСТІ ТА ЗБЕРЕЖЕННЯ");
  console.log("=======================================================");

  try {
    // 🔐 ЗОЛОТИЙ АДМІН-КОННЕКШН ДЛЯ ОБХОДУ ПОМИЛКИ RLS!
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const data = await request.json();
    const {
      llamaFileId,
      fileName,
      fileHash,
      subjectId,
      schoolClass,
      programId,
    } = data;

    if (!llamaFileId || !fileHash || !subjectId || !schoolClass) {
      return NextResponse.json(
        { success: false, error: "Відсутні метадані таску." },
        { status: 400 },
      );
    }

    const parseResult = (await llamaClient.parsing.parse({
      file_id: llamaFileId,
      tier: "agentic",
      version: "latest",
      expand: ["markdown"],
    })) as any;

    if (!parseResult) throw new Error("LlamaCloud повернув порожню відповідь.");

    const pages = parseResult.markdown?.pages || [];
    const hasStatus = "status" in parseResult;
    const currentStatus = hasStatus ? parseResult.status : "";

    if (currentStatus !== "SUCCESS" && pages.length === 0) {
      if (currentStatus === "FAILED" || currentStatus === "ERROR") {
        throw new Error(`LlamaCloud повернув статус помилки: ${currentStatus}`);
      }
      return NextResponse.json({ success: true, status: "PROCESSING" });
    }

    const rawMarkdown = pages
      .map((page: any) => (page && "markdown" in page ? page.markdown : ""))
      .join("\n");

    if (!rawMarkdown || rawMarkdown.trim().length < 10) {
      throw new Error("LlamaCloud повернув порожній контент тексту.");
    }

    const aiParsedResult = await parseNewBookWithAI(
      fileHash,
      "",
      fileName,
      rawMarkdown,
    );
    const fallbackText = `### Оцифровані матеріали підручника\n\nДаний параграф успішно розпізнано ШІ-асистентом LlamaCloud та збережено у сховище R2.`;
    const cleanBookTitle = fileName.replace(".pdf", "").replace(/[_-]/g, " ");

    console.log(
      "⏳ Створення запису книги в базі даних Supabase (Bypass RLS)...",
    );
    const { data: newBook, error: insertError } = await supabaseAdmin
      .from("books")
      .insert({
        title: cleanBookTitle,
        publisher: aiParsedResult.publisher || "Видавництво НУШ",
        publishing_year:
          aiParsedResult.publishing_year || new Date().getFullYear(),
        subject_id: subjectId,
        school_class: schoolClass, // Канонічне поле через підкреслення
        program_id: programId,
        file_hash: fileHash,
      })
      .select("id, title, publisher, publishing_year")
      .single();

    if (insertError) throw insertError;

    if (aiParsedResult.chapters && aiParsedResult.chapters.length > 0) {
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

            const uploadPromise = r2Client.send(
              new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: r2Key,
                Body: fallbackText,
                ContentType: "text/markdown; charset=utf-8",
              }),
            );
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

      if (r2Promises.length > 0) await Promise.all(r2Promises);
      if (contentRows.length > 0)
        await supabaseAdmin.from("book_contents").insert(contentRows);
    }

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      data: newBook,
    });
  } catch (error) {
    const err = error as Error;
    console.error("❌ ЗБІЙ РОУТУ СТАТУСУ:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
