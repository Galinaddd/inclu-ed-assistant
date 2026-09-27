import OpenAI from "openai";
import { createServerConnection } from "@/app/utils/supabase/server"; // ✨ Підключення до БД
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
  userRole: "teacher" | "family";
  subjectName: string;
  // ✨ ПЕРЕДАЄМО ГОТОВІ ДАНІ З КЛІЄНТА (Економія на запитах до профілю)
  clientChildData: {
    id: string;
    child_name: string;
    school_class: number;
    support_level: number;
    child_age: number;
    diagnosis_code: string;
    diagnosis_title: string;
  };
}): Promise<AdaptationServiceResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY відсутній у .env.local");
  }

  // Розпаковуємо чисті дані дитини, які прилетіли з клієнта за 0 мілісекунд
  const {
    id: childId,
    child_name,
    school_class,
    support_level,
    child_age,
    diagnosis_title,
    diagnosis_code,
  } = params.clientChildData;

  // 🛡️ БЕЗПЕКА СЕРВЕРА: Зчитуємо тільки важку системну інструкцію ШІ з довідника ref_diagnoses
  const supabase = await createServerConnection();
  const { data: diagnosisData } = await supabase
    .from("ref_diagnoses")
    .select("ai_instructions")
    .eq("code", diagnosis_code)
    .single();

  const aiInstructions =
    diagnosisData?.ai_instructions ||
    "Стандартна адаптація тексту відповідно до віку дитини.";

  // =================================================================
  // 🧠 ✨ АВТОМАТИЧНИЙ РОЗУМНИЙ ПЕРЕМИКАЧ МОДЕЛЕЙ (МАКСИМАЛЬНА ЕКОНОМІЯ)
  // =================================================================
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
    school_class > 4;

  // Залізне правило вибору «мозку» для генерації
  const modelToUse =
    params.userRole === "teacher" || // Вчителю завжди найкращу модель
    isSeniorScience || // Старші точні науки
    isAdvancedMath // Математика 5-11 класів
      ? "gpt-4o"
      : "gpt-4o-mini"; // 1-4 клас для мами (включаючи Математику) йде через дешеву модель!

  console.log(
    `[ШІ-Диспетчер] Жива адаптація для: ${child_name} (Клас: ${school_class}, Код Діагнозу: ${diagnosis_code}). Модель: ${modelToUse}`,
  );

  // =================================================================

  // 2. Розділяємо логіку на Системний закон та Вхідні дані користувача
  const systemPrompt = generateSystemPrompt({
    childName: child_name,
    diagnosisTitle: diagnosis_title,
    aiInstructions: aiInstructions,
    supportLevel: support_level,
    schoolClass: school_class,
    childAge: child_age,
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
        content: `ОРИГІНАЛЬНИЙ ТЕКСТ ПАРАГРАФА ДЛЯ АДАПТАЦІЇ:\n\"\"\"\n${params.text}\n\"\"\"`,
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
  const r2Key = `personal-materials/${params.userId}/${childId}/${adaptationUuid}.txt`;

  return { aiText, autoTitle, r2Key };
}
