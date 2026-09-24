import OpenAI from "openai";
import { generateSystemPrompt } from "./prompt-templates";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AdaptationServiceResult {
  aiText: string;
  autoTitle: string;
  r2Key: string;
}

export async function runTextAdaptationPipeline(params: {
  userId: string;
  text: string;
  childId: string;
  userRole: "teacher" | "family";
  subjectName: string;
}): Promise<AdaptationServiceResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY відсутній у .env.local");
  }

  // 1. Еталонні параметри профілю дитини (Тимчасова заглушка з бази)
  const mockChild = {
    childName: "Максимко",
    diagnosisTitle: "Rozlady avtystychnoho spektra (RAS)",
    aiInstructions:
      "Формуй жорстку покрокову інструкцію, уникай абстрактних метафор, алегорій та двозначностей. Спрощуй складні речення на короткі тези. Додавай інтерактивні чек-бокси [ ].",
    supportLevel: 3,
    schoolClass: 3, // Математика 1-4 класів для мами піде через дешеву модель!
    childAge: 8,
  };

  // =================================================================
  // 🧠 ✨ АВТОМАТИЧНИЙ РОЗУМНИЙ ПЕРЕМИКАЧ МОДЕЛЕЙ (ЕКОНОМІЯ БЮДЖЕТУ)
  // =================================================================

  // Перелік складних STEM-предметів СТАРШОЇ школи (без початкової математики)
  const seniorExactSciences = [
    "алгебра",
    "геометрія",
    "фізика",
    "хімія",
    "астрономія",
    "креслення",
    "інформатика",
  ];

  const isSeniorScience = seniorExactSciences.some((science) =>
    params.subjectName.toLowerCase().trim().includes(science),
  );

  // Перевіряємо, чи це математика, але вже СТАРШИХ класів (від 5-го і вище)
  const isAdvancedMath =
    params.subjectName.toLowerCase().trim().includes("математика") &&
    mockChild.schoolClass > 4;

  // Залізне правило вибору «мозку» для генерації
  const modelToUse =
    params.userRole === "teacher" || // Вчителю завжди найкращу модель
    isSeniorScience || // Старші точні науки
    isAdvancedMath // Математика 5-11 класів
      ? "gpt-4o"
      : "gpt-4o-mini"; // 1-4 клас для мами (включаючи Математику) йде через дешеву модель!

  console.log(
    `[ШІ-Диспетчер] Визначено модель для генерації: ${modelToUse} (Предмет: ${params.subjectName}, Клас: ${mockChild.schoolClass}, Роль: ${params.userRole})`,
  );

  // =================================================================

  // 2. Розділяємо логіку на Системний закон та Вхідні дані користувача
  const systemPrompt = generateSystemPrompt({
    childName: mockChild.childName,
    diagnosisTitle: mockChild.diagnosisTitle,
    aiInstructions: mockChild.aiInstructions,
    supportLevel: mockChild.supportLevel,
    schoolClass: mockChild.schoolClass,
    childAge: mockChild.childAge,
    userRole: params.userRole,
    subjectName: params.subjectName,
  });

  // 3. Запит із ТЕМПЕРАТУРОЮ 0.15 та динамічно підібраною моделлю
  const response = await openai.chat.completions.create({
    model: modelToUse, // 🔥 Наш розумний перемикач
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `ОРИГІНАЛЬНИЙ ТЕКСТ ПАРАГРАФА ДЛЯ АДАПТАЦІЇ:\n\"\"\"\n${params.text}\n\"\"flip"`,
      },
    ],
    temperature: 0.15, // Заземлюємо ШІ, щоб не вигадував дурниць
  });

  const aiText = response.choices?.[0]?.message?.content;
  if (!aiText) throw new Error("ШІ повернув порожню відповідь.");

  // 4. ПРАВИЛО АВТО-НЕЙМІНГУ
  let autoTitle = params.text.trim().substring(0, 40);
  if (params.text.length > 40) autoTitle += "...";
  if (params.userRole === "teacher") autoTitle = `Конспект: ${autoTitle}`;

  // 5. Формуємо персональний ключ для Cloudflare R2
  const adaptationUuid = crypto.randomUUID();
  const r2Key = `personal-materials/${params.userId}/${params.childId}/${adaptationUuid}.txt`;

  return { aiText, autoTitle, r2Key };
}
