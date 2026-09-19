import OpenAI from "openai";
import { generateAdaptationPrompt } from "./prompt-templates";

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

  // 1. Еталонні параметри профілю дитини (Тимчасовий бойовий зразок для тестування ядра)
  const mockChild = {
    childName: "Максимко",
    diagnosisTitle: "Розлади автистичного спектра (РАС)",
    aiInstructions:
      "ROLE: Expert in Inclusive education for Autism Spectrum Disorder (ASD). Формуй жорстку покрокову інструкцію, уникай абстрактних метафор та двозначностей. Спрощуй складні речення на короткі тези.",
    supportLevel: 3,
    schoolClass: 3,
    childAge: 8,
  };

  // 2. Генерація промпту з правильними пропсами під вашу базу даних
  const finalPrompt = generateAdaptationPrompt({
    childName: mockChild.childName,
    diagnosisTitle: mockChild.diagnosisTitle, // 🔥 Виправлено: передаємо правильну назву пропса!
    aiInstructions: mockChild.aiInstructions, // 🔥 Виправлено: інтегрували ядро інструкції з бази!
    supportLevel: mockChild.supportLevel,
    schoolClass: mockChild.schoolClass,
    childAge: mockChild.childAge,
    userRole: params.userRole,
    subjectName: params.subjectName,
    rawText: params.text,
  });

  // 3. Блискавичний та економний запит до gpt-4o-mini
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: finalPrompt }],
    temperature: 0.6,
  });

  const aiText = response.choices?.[0]?.message?.content;
  if (!aiText) throw new Error("ШІ повернув порожню відповідь.");

  // 4. ПРАВИЛО АВТО-НЕЙМІНГУ: обрізаємо перші 40 символів по слову з Паспорта
  let autoTitle = params.text.trim().substring(0, 40);
  if (params.text.length > 40) autoTitle += "...";
  if (params.userRole === "teacher") autoTitle = `Конспект: ${autoTitle}`;

  // 5. Формуємо персональний ключ (Флоу №3 Шлях Мами / Конспекти)
  const adaptationUuid = crypto.randomUUID();
  const r2Key = `personal-materials/${params.userId}/${params.childId}/${adaptationUuid}.txt`;

  return { aiText, autoTitle, r2Key };
}
