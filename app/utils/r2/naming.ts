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
 * 🔥 ОНОВЛЕНО: Тепер збирає структуру всередині нашої нової папки books/content/
 * Формує шлях: books/content/[program_id]/[class]/[subject_id]/[author_year]/paragraphs/paragraph_[num].txt
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
  return `books/content/${params.programId}/${params.schoolClass}/${params.subjectId}/${cleanAuthor}_${params.year}/paragraphs/paragraph_${params.paragraphNumber}.txt`;
}

/**
 * 📁 ГЕНЕРАТОР КЛЮЧІВ ДЛЯ АДАПТОВАНИХ ШІ-МАТЕРІАЛІВ
 * 🔥 ОНОВЛЕНО: Зберігає кеш готових адаптацій підручника поруч із оригіналом в books/content/
 * Формує шлях: books/content/[program_id]/[class]/[subject_id]/[author_year]/adapted/paragraph_[num]_level_[lvl]_[diagnosis].txt
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
  return `books/content/${params.programId}/${params.schoolClass}/${params.subjectId}/${cleanAuthor}_${params.year}/adapted/paragraph_${params.paragraphNumber}_level_${params.targetSupportLevel}_${cleanDiagnosis}.txt`;
}

/**
 * 📁 ГЕНЕРАТОР ПЕРСОНАЛЬНИХ КЛЮЧІВ ДЛЯ КОНКРЕТНОЇ ДИТИНИ (БАТЬКІВСЬКІ МАТЕРІАЛІ)
 * 🔥 ОНОВЛЕНО: Переспрямовано у нову глобальну папку personal/images/
 * Формує ізольований шлях: personal/images/[user_id]/[child_id]/[uuid].png
 */
export function generatePersonalKey(params: {
  userId: string;
  childId: string;
  adaptationUuid: string;
}): string {
  // За замовчуванням ставимо .png, оскільки батьки найчастіше надсилатимуть фото з телефону
  return `personal/images/${params.userId}/${params.childId}/${params.adaptationUuid}.png`;
}

/**
 * 📁 ГЕНЕРАТОР КЛЮЧІВ ДЛЯ ФІНАЛЬНИХ ПЕРСОНАЛЬНИХ АДАПТАЦІЙ БАТЬКІВ (ЗБЕРІГАЄМО ДО КІНЦЯ НАВЧАЛЬНОГО РОКУ)
 * 🔥 НОВИЙ МЕТОД: Формує ізольований шлях для готового адаптованого тексту домашки
 * Формує шлях: personal/adapted/[user_id]/[child_id]/[uuid].txt
 */
export function generatePersonalAdaptedKey(params: {
  userId: string;
  childId: string;
  adaptationUuid: string;
}): string {
  return `personal/adapted/${params.userId}/${params.childId}/${params.adaptationUuid}.txt`;
}
