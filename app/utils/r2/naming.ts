// 📂 Шлях до файлу: utils/r2/naming.ts

/**
 * 🛠️ БЕЗПЕЧНЕ ОЧИЩЕННЯ ТЕКСТУ (SLUGIFY)
 */
export function slugify(text: string): string {
  if (!text) return "unnamed";
  return text
    .toLowerCase()
    .trim()
    .replace(/[§.№]/g, "")
    .replace(/[^a-z0-9а-яєіїґ]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+\$/g, "");
}

// =========================================================================
// 📁 1. ГЛОБАЛЬНИЙ РОЗДІЛ books/ (Офіційні підручники НУШ)
// =========================================================================

/**
 * А. Оригінальний важкий PDF-файл підручника
 * Шлях: books/source-pdf/${fileHash}.pdf
 */
export function getBookSourcePdfKey(fileHash: string): string {
  return `books/source-pdf/${fileHash}.pdf`;
}

/**
 * Б. Повний сирий Markdown-текст усієї книги від Llama Cloud
 * Шлях: books/raw-markdown/${fileHash}.md
 */
export function getBookRawMarkdownKey(fileHash: string): string {
  return `books/raw-markdown/${fileHash}.md`;
}

/**
 * В. 🪓 ОРИГІНАЛЬНА НАЗВА ЗБЕРЕЖЕНА: Чисті оригінальні текстові параграфи підручника
 * Суворо за концепцією: books/content/${fileHash}/paragraphs/paragraph_[номер].txt
 */
export function generateSourceKey(params: {
  fileHash: string;
  paragraphNumber: string | number;
}): string {
  const formattedNum = String(params.paragraphNumber).padStart(3, "0");
  return `books/content/${params.fileHash}/paragraphs/paragraph_${formattedNum}.md`;
}

/**
 * Г. Картинки, графіки, формули, вирізані Ламою з підручника
 * Шлях: books/content/${fileHash}/images/${imageName}
 */
export function getBookImageKey(fileHash: string, imageName: string): string {
  return `books/content/${fileHash}/images/${slugify(imageName)}`;
}

/**
 * Ґ. 🪓 ОРИГІНАЛЬНА НАЗВА ЗБЕРЕЖЕНА: Готові, вже адаптовані ШІ версії параграфа (Кеш)
 * Суворо за концепцією: books/content/${fileHash}/adapted/paragraph_[номер]_level_[рівень]_[діагноз].txt
 */
export function generateAdaptedKey(params: {
  fileHash: string;
  paragraphNumber: string | number;
  targetSupportLevel: number | string;
  targetDiagnosis: string;
}): string {
  const formattedNum = String(params.paragraphNumber).padStart(3, "0");
  const cleanDiagnosis = slugify(params.targetDiagnosis);
  return `books/content/${params.fileHash}/adapted/paragraph_${formattedNum}_level_${params.targetSupportLevel}_${cleanDiagnosis}.txt`;
}

// =========================================================================
// 📁 2. ГЛОБАЛЬНИЙ РОЗДІЛ personal/ (Приватні матеріали батьків/вчителів)
// =========================================================================

/**
 * А. 🪓 ОРИГІНАЛЬНА НАЗВА ЗБЕРЕЖЕНА: Фотокартка зошита чи скан самостійної від батьків
 * Шлях: personal/images/[userId]/[childId]/[adaptationUuid].png
 */
export function generatePersonalKey(params: {
  userId: string;
  childId: string;
  adaptationUuid: string;
}): string {
  return `personal/images/${params.userId}/${params.childId}/${params.adaptationUuid}.png`;
}

/**
 * Б. 🪓 ОРИГІНАЛЬНА НАЗВА ЗБЕРЕЖЕНА: Фінальний адаптований ШІ текст домашнього завдання
 * Шлях: personal/adapted/[userId]/[childId]/[adaptationUuid].txt
 */
export function generatePersonalAdaptedKey(params: {
  userId: string;
  childId: string;
  adaptationUuid: string;
}): string {
  return `personal/adapted/${params.userId}/${params.childId}/${params.adaptationUuid}.txt`;
}
