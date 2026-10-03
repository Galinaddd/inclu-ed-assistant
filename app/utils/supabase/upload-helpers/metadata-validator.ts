// 📂 Заменить логику проверки предмета внутри функции validateNushMetadata
export function validateNushMetadata(
  detected: { detectedClass: number; detectedSubject: string },
  expectedClass: number,
  expectedSubjectName: string,
) {
  // 1. Сначала железная проверка класса (она у тебя уже работает идеально)
  if (detected.detectedClass !== expectedClass) {
    throw new Error(
      `🚨 Помилка валідації НУШ: Цей підручник містить маркери ${detected.detectedClass}-го класу, а ви завантажуєте його в кабінет ${expectedClass}-го класу!`,
    );
  }

  // ========================================================
  // 🎯 УНІВЕРСАЛЬНА ПЕРЕВІРКА ПРЕДМЕТА БЕЗ СЛОВНИКІВ (НА ЛЬОТУ)
  // ========================================================

  // Приводим к нижнему регистру всё, что у нас есть
  const expectedLower = expectedSubjectName.toLowerCase().trim();
  const detectedLower = detected.detectedSubject.toLowerCase().trim();

  // Вырезаем корень ожидаемого предмета (отбрасываем окончания типа -ія, -ика, -а)
  // Для "Хімія" -> "хім", для "Фізика" -> "фізик", для "Геометрія" -> "геометр"
  const subjectRoot = expectedLower
    .replace(/(ія|ика|а|ка|ографія|ематика)\$/, "") // Срезаем стандартные окончания предметов
    .slice(0, 5); // Берем первые 5 чистых символов корня

  // Проверяем: есть ли этот универсальный корень в том тексте, который распарсил сервер?
  const isSubjectMatch =
    detectedLower.includes(subjectRoot) ||
    expectedLower.includes(detectedLower) ||
    detectedLower.includes(expectedLower);

  console.log(
    `🔍 [УНІВЕРСАЛЬНИЙ ВАЛІДАТОР] Корінь предмета: "${subjectRoot}". Збіг знайдено: ${isSubjectMatch}`,
  );

  // Если ШІ-парсер или filename-парсер выдали предмет, в котором вообще нет пересечений с кабинетом
  if (!isSubjectMatch && detected.detectedSubject !== "Предмет НУШ") {
    throw new Error(
      `🚨 Помилка дисципліни: Цей підручник визначено як "${detected.detectedSubject}", а ваш поточний кабінет — "${expectedSubjectName}". Перевірте правильність файлу!`,
    );
  }
}
