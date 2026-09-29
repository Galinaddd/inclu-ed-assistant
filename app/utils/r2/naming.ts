// 📂 Шлях до файлу: utils/r2/naming.ts

/**
 * 🛠️ БЕЗПЕЧНЕ ОЧИЩЕННЯ ТЕКСТУ (SLUGIFY)
 * Перетворює кирилицю та латиницю на безпечні технічні назви для теках у хмарі.
 */
export function slugify(text: string): string {
  if (!text) return "unnamed";
  return text
    .toLowerCase()
    .trim()
    .replace(/[§.№]/g, "") // Видаляємо специфічні символи
    .replace(/[^a-z0-9а-яєіїґ]/g, "_") // Міняємо пробіли та спецсимволи на підкреслення
    .replace(/_+/g, "_") // Запобігаємо подвійним підкресленням
    .replace(/^_+|_+\$/g, ""); // Очищаємо хвости
}

/**
 * 📁 ГЕНЕРАТОР КЛЮЧІВ ДЛЯ ОРИГІНАЛЬНИХ ПАРАГРАФІВ (ПЕРШОДЖЕРЕЛА)
 * Формує шлях: source-books/[program_id]/[class]/[subject_id]/[author_year]/paragraph_[num].txt
 */
export function generateSourceKey(params: {
  programId: string;
  schoolClass: number;
  subjectId: string;
  author: string;
  year: number;
  paragraphNumber: string;
}): string {
  const cleanAuthor = slugify(params.author);
  return `source-books/${params.programId}/${params.schoolClass}/${params.subjectId}/${cleanAuthor}_${params.year}/paragraph_${params.paragraphNumber}.txt`;
}

/**
 * 📁 ГЕНЕРАТОР КЛЮЧІВ ДЛЯ АДАПТОВАНИХ ШІ-МАТЕРІАЛІВ
 * Формує шлях: adapted-materials/[program_id]/[class]/[subject_id]/[author_year]/paragraph_[num]_level_[lvl]_[diagnosis].txt
 */
export function generateAdaptedKey(params: {
  programId: string;
  schoolClass: number;
  subjectId: string;
  author: string;
  year: number;
  paragraphNumber: string;
  targetSupportLevel: number;
  targetDiagnosis: string;
}): string {
  const cleanAuthor = slugify(params.author);
  const cleanDiagnosis = slugify(params.targetDiagnosis);
  return `adapted-materials/${params.programId}/${params.schoolClass}/${params.subjectId}/${cleanAuthor}_${params.year}/paragraph_${params.paragraphNumber}_level_${params.targetSupportLevel}_${cleanDiagnosis}.txt`;
}

/**
 * 📁 ГЕНЕРАТОР ПЕРСОНАЛЬНИХ КЛЮЧІВ ДЛЯ КОНКРЕТНОЇ ДИТИНИ
 * Формує ізольований шлях: personal-materials/[user_id]/[child_id]/[uuid].txt
 */
export function generatePersonalKey(params: {
  userId: string;
  childId: string;
  adaptationUuid: string;
}): string {
  return `personal-materials/${params.userId}/${params.childId}/${params.adaptationUuid}.txt`;
}
