/**
 * Безпечне очищення імені автора для використання в назвах папок хмари
 */
export function normalizeAuthorName(author: string): string {
  return author.toLowerCase().replace(/[^a-z0-9а-яєіїґ]/g, "_");
}

/**
 * ГЕНЕРАТОР ШЛЯХУ ДЛЯ ОРИГІНАЛУ КНИГИ (Флоу №2)
 * Формує: source-books/[program_id]/[class]/[subject_id]/[author]_[year]/paragraph_[N].txt
 */
export function generateSourceKey(params: {
  programId: string;
  schoolClass: number;
  subjectId: string;
  author: string;
  year: number;
  paragraphNumber: string;
}): string {
  const cleanAuthor = normalizeAuthorName(params.author);
  return `source-books/${params.programId}/${params.schoolClass}/${params.subjectId}/${cleanAuthor}_${params.year}/paragraph_${params.paragraphNumber}.txt`;
}

/**
 * ГЕНЕРАТОР ШЛЯХУ ДЛЯ ГЛОБАЛЬНОГО ШІ-АРХІВУ (Флоу №1)
 * Формує: generated-materials/[program]/[class]/[subject_id]/[author]_[year]/paragraph_[N]/level_[L]_[diagnosis].txt
 */
export function generateAdaptedKey(params: {
  programSlug: string;
  targetSchoolClass: number;
  subjectId: string;
  author: string;
  year: number;
  paragraphNumber: string;
  targetSupportLevel: number;
  targetDiagnosis: string;
}): string {
  const cleanAuthor = normalizeAuthorName(params.author);
  return `generated-materials/${params.programSlug}/${params.targetSchoolClass}/${params.subjectId}/${cleanAuthor}_${params.year}/paragraph_${params.paragraphNumber}/level_${params.targetSupportLevel}_${params.targetDiagnosis}.txt`;
}

/**
 * ГЕНЕРАТОР ШЛЯХУ ДЛЯ ПЕРСОНАЛЬНОГО АРХІВУ (Флоу №3 — Шлях Мами / Швидкий текст)
 * Формує: personal-materials/[user_id]/[child_id]/[adaptation_uuid].txt
 */
export function generatePersonalKey(params: {
  userId: string;
  childId: string;
  adaptationUuid: string;
}): string {
  return `personal-materials/${params.userId}/${params.childId}/${params.adaptationUuid}.txt`;
}
