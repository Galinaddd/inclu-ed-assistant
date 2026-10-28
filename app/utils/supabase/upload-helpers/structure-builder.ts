// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/structure-builder.ts

import { ChapterStructure, ParagraphStructure } from "./types";
// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/structure-builder.ts
import { generateSourceKey } from "@/app/utils/r2/naming";
import { uploadTextToR2 } from "@/app/utils/r2/r2-helpers";

// Ваши інтерфейси типів з app/utils/supabase/upload-helpers/types.ts

/**
 * 🔥 НОВА ЧИСТА ФУНКЦІЯ ДЛЯ СТРІМІНГУ ТА ФОРМУВАННЯ JSONB МАПИ
 * Приймає масив нарізаної структури, заливає файли в R2 і повертає чистий JSON для бази.
 */
export async function processAndStreamBookStructure(
  rawBookStructure: any[],
  fileHash: string,
): Promise<any[]> {
  let paragraphGlobalCounter = 1;
  const finalizedStructure = [];

  for (const chapter of rawBookStructure) {
    const finalizedParagraphs = [];

    for (const paragraph of chapter.paragraphs) {
      // 1. Генеруємо ключ суворо за концепцією: books/content/${fileHash}/paragraphs/paragraph_[номер].txt
      const paragraphR2Key = generateSourceKey({
        fileHash: fileHash,
        paragraphNumber: paragraphGlobalCounter,
      });

      console.log(
        `🚀 [STRUCTURE-PROCESSOR] Стрімінг параграфа №${paragraphGlobalCounter} в R2...`,
      );

      // 2. Завантажуємо оригінальний текст параграфа в Cloudflare R2
      await uploadTextToR2(paragraphR2Key, paragraph.markdown_content);

      // 3. Формуємо поле для легкого JSONB без важкого тексту всередині
      finalizedParagraphs.push({
        id: paragraph.id,
        title: paragraph.title,
        r2_path: paragraphR2Key, // Фронтенд-акордеон стягне маркдаун звідси
      });

      paragraphGlobalCounter++;
    }

    finalizedStructure.push({
      id: chapter.id,
      title: chapter.title,
      paragraphs: finalizedParagraphs,
    });
  }

  return finalizedStructure;
}

/**
 * Будує мапу (структуру) книги на основі маркдауну від Llama Cloud
 */
export function buildBookStructure(fullMarkdown: string): ChapterStructure[] {
  if (!fullMarkdown) return [];

  const structure: ChapterStructure[] = [];
  const chunks = fullMarkdown.split(/^##\s+/gm);

  const introChunk = chunks.shift()?.trim();
  if (introChunk && introChunk.length > 50) {
    structure.push({
      chapter: "Титульна сторінка та передмова",
      paragraphs: [
        {
          number: "0",
          title: "Вступна інформація",
          markdown_content: introChunk,
        },
      ],
    });
  }

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const rawTitle = lines[0]?.trim();
    const body = lines.slice(1).join("\n").trim();

    if (!rawTitle) continue;

    let chapterTitle = rawTitle.replace(/<\/?[^>]+(>|$)/g, "").trim();

    if (
      chapterTitle.length <= 4 &&
      chapterTitle.includes(chapterTitle.toLowerCase())
    ) {
      chapterTitle = `Вивчаємо літеру: ${chapterTitle}`;
    }

    const subChunks = body.split(/^###\s+/gm);
    const paragraphs: ParagraphStructure[] = [];

    const mainBodyText = subChunks.shift()?.trim();
    if (mainBodyText && mainBodyText.length > 5) {
      paragraphs.push({
        number: "1",
        title: "Основна тема / Ознайомлення",
        markdown_content: `## ${rawTitle}\n\n${mainBodyText}`,
      });
    }

    let pCounter = paragraphs.length + 1;
    for (const subChunk of subChunks) {
      const subLines = subChunk.split("\n");
      const subTitle = subLines[0]?.replace(/<\/?[^>]+(>|$)/g, "").trim();
      const subBody = subLines.slice(1).join("\n").trim();

      paragraphs.push({
        number: `${pCounter++}`,
        title: subTitle || "Підтема",
        markdown_content: `### ${subLines[0]}\n\n${subBody}`,
      });
    }

    if (paragraphs.length === 0 && body.length > 0) {
      paragraphs.push({
        number: "1",
        title: "Читати повністю",
        markdown_content: `## ${rawTitle}\n\n${body}`,
      });
    }

    if (paragraphs.length > 0) {
      structure.push({
        chapter: chapterTitle,
        paragraphs: paragraphs,
      });
    }
  }

  return structure;
}
