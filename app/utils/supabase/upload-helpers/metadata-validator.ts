// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/metadata-validator.ts

/**
 * 🛡️ КРОК 3: СУВОРРИЙ ПОСЛІДОВНИЙ КРОС-ФІЛЬТР ВІД ПОМИЛОК КОРИСТУВАЧА
 * Перевірки відбуваються строго по черзі. Клас перевіряється НАЙПЕРШИМ!
 */
export function validateNushMetadata(
  meta: { detectedClass: number | null; detectedSubject: string | null },
  expectedClass: number,
  expectedSubjectName: string,
): void {
  console.log(
    "⏳ [МОДУЛЬ ЗАВАНТАЖЕННЯ] Запуск послідовного крос-фільтру бізнес-правил...",
  );

  // 1. ✨ ТВОЄ ЗАЛІЗНЕ ПРАВИЛО: Клас перевіряється першим ділом!
  if (meta.detectedClass !== null && meta.detectedClass !== expectedClass) {
    throw new Error(
      `🚨 Клас підручника не збігається! Кабінет: ${expectedClass} клас, а на титулці файлу знайдено: ${meta.detectedClass} клас.`,
    );
  }

  // 2. Лише якщо клас ідеально збігся, перевіряємо відповідність дисципліни
  if (meta.detectedSubject === "Невідповідний предмет") {
    throw new Error(
      `🚨 Предмет підручника не збігається! Ви намагаєтесь додати цей файл у кабінет "${expectedSubjectName}", проте в тексті книги та назві файлу не знайдено жодного збігу з цією дисципліною.`,
    );
  }
}
