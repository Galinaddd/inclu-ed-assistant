// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/structure-builder.ts
import { generateSourceKey } from "@/app/utils/r2/naming";
import { uploadTextToR2 } from "@/app/utils/r2/r2-helpers";

export interface LlamaElement {
  type: "heading" | "text" | "table" | "image" | string;
  level?: number;
  md?: string;
  value?: string;
}

export interface LlamaPageItem {
  page_number: number;
  items: LlamaElement[];
}

export interface ParagraphStructure {
  id: string;
  title: string;
  markdown_content: string;
}

export interface ChapterStructure {
  id: string;
  chapter: string;
  paragraphs: ParagraphStructure[];
}

/**
 * 🔥 ФУНКЦІЯ ДЛЯ СТРІМІНГУ ТА ФОРМУВАННЯ JSONB МАПИ В SUPABASE
 */
export async function processAndStreamBookStructure(
  rawBookStructure: ChapterStructure[],
  fileHash: string,
): Promise<any[]> {
  let paragraphGlobalCounter = 1;
  const finalizedStructure = [];

  for (const chapter of rawBookStructure) {
    const finalizedParagraphs = [];

    for (const paragraph of chapter.paragraphs) {
      const paragraphR2Key = generateSourceKey({
        fileHash: fileHash,
        paragraphNumber: paragraphGlobalCounter,
      });

      console.log(
        `🚀 [R2-STREAM] Завантаження параграфа №${paragraphGlobalCounter} в R2...`,
      );
      await uploadTextToR2(paragraphR2Key, paragraph.markdown_content);

      finalizedParagraphs.push({
        id: paragraph.id,
        title: paragraph.title || "Читати тему повністю",
        r2_path: paragraphR2Key,
      });

      paragraphGlobalCounter++;
    }

    finalizedStructure.push({
      id: chapter.id,
      title: chapter.chapter,
      paragraphs: finalizedParagraphs,
    });
  }

  return finalizedStructure;
}

/**
 * ⚡️ УНІВЕРСАЛЬНИЙ НІЖ: Будує ідеальну структуру книги для Букваря та Історії 11 класу
 */
export function buildBookStructure(
  pageItems: LlamaPageItem[],
): ChapterStructure[] {
  if (!pageItems || pageItems.length === 0) return [];

  // 1. Сортуємо фізичні сторінки підручника
  const sortedPages = [...pageItems].sort(
    (a, b) => a.page_number - b.page_number,
  );

  // 2. Зшиваємо елементи всіх сторінок в один плоский ланцюжок (кордони сторінок зникають)
  const allElements: LlamaElement[] = [];
  sortedPages.forEach((page) => {
    if (page.items && Array.isArray(page.items)) {
      allElements.push(...page.items);
    }
  });

  // 3. Динамічно визначаємо рівні заголовків автора
  let minHeadingLevel = 7;
  let maxHeadingLevel = 0;
  let hasHeadings = false;

  allElements.forEach((el) => {
    if (el.type === "heading" && el.level) {
      hasHeadings = true;
      if (el.level < minHeadingLevel) minHeadingLevel = el.level;
      if (el.level > maxHeadingLevel) maxHeadingLevel = el.level;
    }
  });

  // Фоллбек, якщо в книзі взагалі немає тегів заголовків
  if (!hasHeadings) {
    const fallbackText = allElements
      .map((el) => el.md || el.value || "")
      .join("\n\n")
      .trim();
    return [
      {
        id: crypto.randomUUID(),
        chapter: "Основний розділ підручника",
        paragraphs: [
          {
            id: crypto.randomUUID(),
            title: "Читати підручник повністю",
            markdown_content: fallbackText,
          },
        ],
      },
    ];
  }

  const chapterLevel = minHeadingLevel;
  const isSingleLevel = minHeadingLevel === maxHeadingLevel;

  // 4. Нарізаємо елементи на логічні блоки від заголовка до заголовка
  interface BlockSlice {
    title: string;
    level: number;
    collectedTexts: string[];
  }

  const slices: BlockSlice[] = [];
  let currentSlice: BlockSlice | null = null;

  const appendToCurrentSlice = (text: string) => {
    if (!text) return;
    if (!currentSlice) {
      currentSlice = {
        title: "Передмова та вступ",
        level: chapterLevel + 1,
        collectedTexts: [],
      };
      slices.push(currentSlice);
    }
    currentSlice.collectedTexts.push(text);
  };

  allElements.forEach((el) => {
    if (el.type === "heading" && el.level !== undefined) {
      const headingPrefix = "#".repeat(el.level);
      const cleanTitle = (el.value || el.md || "Без назви")
        .replace(/^[#\s]+/, "")
        .trim();

      currentSlice = {
        title: cleanTitle,
        level: el.level,
        collectedTexts: [`${headingPrefix} ${cleanTitle}`],
      };
      slices.push(currentSlice);
    } else {
      appendToCurrentSlice(el.md || el.value || "");
    }
  });

  const structure: ChapterStructure[] = [];
  let activeChapter: ChapterStructure | null = null;

  const createParagraphObj = (
    title: string,
    texts: string[],
  ): ParagraphStructure => {
    const cleanTitle = title.replace(/<\/?[^>]+(>|$)/g, "").trim();
    return {
      id: crypto.randomUUID(),
      title: cleanTitle,
      markdown_content: texts.join("\n\n").trim(),
    };
  };

  // СЦЕНАРІЙ А: Системна книга з ієрархією (Історія 11 класу: ## Розділ -> ### Параграф)
  if (!isSingleLevel) {
    slices.forEach((slice) => {
      if (slice.level === chapterLevel) {
        activeChapter = {
          id: crypto.randomUUID(),
          chapter: slice.title.replace(/<\/?[^>]+(>|$)/g, "").trim(),
          paragraphs: [],
        };
        structure.push(activeChapter);

        if (slice.collectedTexts.length > 1) {
          activeChapter.paragraphs.push(
            createParagraphObj("Ознайомлення з розділом", slice.collectedTexts),
          );
        }
      } else {
        if (!activeChapter) {
          activeChapter = {
            id: crypto.randomUUID(),
            chapter: "Вступна частина підручника",
            paragraphs: [],
          };
          structure.push(activeChapter);
        }
        activeChapter.paragraphs.push(
          createParagraphObj(slice.title, slice.collectedTexts),
        );
      }
    });
  }
  // СЦЕНАРІЙ Б: Лінійний підручник (Буквар 1 класу: Тільки один рівень заголовків)
  else {
    const ITEMS_PER_GROUP = 5;
    slices.forEach((slice, idx) => {
      if (idx % ITEMS_PER_GROUP === 0) {
        let cleanChapterTitle = slice.title
          .replace(/<\/?[^>]+(>|$)/g, "")
          .trim();
        if (
          cleanChapterTitle.length <= 4 &&
          cleanChapterTitle.includes(cleanChapterTitle.toLowerCase())
        ) {
          cleanChapterTitle = `Вивчаємо літеру: ${cleanChapterTitle}`;
        } else {
          cleanChapterTitle = `Блок: ${cleanChapterTitle}`;
        }

        activeChapter = {
          id: crypto.randomUUID(),
          chapter: cleanChapterTitle,
          paragraphs: [],
        };
        structure.push(activeChapter);
      }

      if (activeChapter) {
        activeChapter.paragraphs.push(
          createParagraphObj(slice.title, slice.collectedTexts),
        );
      }
    });
  }

  return structure.filter((ch) => ch.paragraphs.length > 0);
}
