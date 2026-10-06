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
