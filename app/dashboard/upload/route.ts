// import { NextRequest, NextResponse } from "next/server";
// import { createAdminServerConnection } from "@/app/utils/supabase/server";
// import {
//   checkFileHashOnly,
//   parsePdfTitlePage,
//   validateNushMetadata,
// } from "@/app/utils/supabase/upload-helpers";
// import { uploadBookToLlamaCloudStream } from "@/app/utils/ai/llama-parser"; // ✨ Викликаємо твій канонічний хелпер
// import fs from "fs";
// import path from "path";

// // ✨ ВИПРАВЛЕНО: Канонічне розширення таймауту для локального сервера Next.js
// // Повністю лікує помилку "Request timed out" при завантаженні великих файлів!
// export const config = {
//   api: {
//     bodyParser: false, // Вимикаємо стандартний парсер, щоб потік не блокувався
//     responseLimit: false,
//   },
// };

// // Залишаємо для продакшену
// export const maxDuration = 300;

// /**
//  * 🛫 ЕТАП 1: ЧИСТИЙ ДИСПЕТЧЕР ЗГІДНО З ОФІЦІЙНИМ МАНУАЛОМ ЛАМИ
//  * Флоу: Швидкий запис ➡️ Крос-валідація ➡️ Дедуплікація БД ➡️ Виклик llama-parser
//  */
// export async function POST(request: NextRequest) {
//   console.log("\n=======================================================");
//   console.log("📥 [API-РОУТ] СТАРТ ЧИСТОГО ДИСПЕТЧЕРА ВАЛІДАЦІЇ ТА АПЛОАДУ");
//   console.log("=======================================================");

//   const tempDir = process.env.TMPDIR || process.env.TMP || "/tmp";
//   const tempFilePath = path.join(tempDir, `book-upload-${Date.now()}.pdf`);

//   try {
//     const supabase = await createAdminServerConnection();
//     const formData = await request.formData();
//     const file = formData.get("file") as File;
//     const fileHash = formData.get("fileHash") as string;
//     const subjectId = formData.get("subjectId") as string;
//     const schoolClass = Number(formData.get("schoolClass"));
//     const programId = (formData.get("programId") as string) || null;
//     const expectedSubjectName =
//       (formData.get("subjectName") as string) || "Предмет НУШ";

//     if (!file || !fileHash) {
//       return NextResponse.json(
//         { success: false, error: "Файл або хеш відсутні." },
//         { status: 400 },
//       );
//     }

//     // ========================================================
//     // 💾 КРОК 1: МИТТЄВИЙ ЗАПИС НА ДИСК БЕЗ ЖОДНИХ ВІСЯЧИХ ЧАНКІВ
//     // ========================================================
//     console.log(`[ФЛОУ 🗂️] Локальне збереження підручника на диск...`);

//     // Зчитуємо масив байтів і записуємо монолітно через writeFileSync.
//     // Це залізобетонно звільняє файл для Windows, щоб потік у Ламу не висів!
//     const arrayBuffer = await file.arrayBuffer();
//     fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));
//     console.log("📌 [ДИСК] Запис файлу успішно завершено. Дескриптор вільний.");

//     // ========================================================
//     // 🛡️ КРОК 2: ПЕРШOЧЕРГОВА ЛОКАЛЬНА КРОС-ВАЛІДАЦІЯ МЕТАДАНИХ
//     // ========================================================
//     console.log(`[ФЛОУ 🔍] Запуск локального парсера метаданих підручника...`);
//     const tempFileForParser = new File(
//       [fs.readFileSync(tempFilePath)],
//       file.name,
//       { type: "application/pdf" },
//     );
//     const pdfMeta = await parsePdfTitlePage(
//       tempFileForParser,
//       fileHash,
//       expectedSubjectName,
//     );

//     console.log(
//       ` Bars [АНАЛІЗ PDF] Виявлено -> Клас: ${pdfMeta.detectedClass}, Предмет: ${pdfMeta.detectedSubject}`,
//     );

//     // Твоя сувора перевірка типів із підстраховкою || 0 та || "" для повної тиші в Problems
//     validateNushMetadata(
//       {
//         detectedClass: pdfMeta.detectedClass || 0,
//         detectedSubject: pdfMeta.detectedSubject || "Предмет НУШ",
//       },
//       schoolClass,
//       expectedSubjectName,
//     );
//     console.log(
//       "✅ [ВАЛІДАЦІЯ УСПІШНА] Файл повністю відповідає дисципліні кабінету.",
//     );

//     // ========================================================
//     // 🧱 КРОК 3: ПОШУК РОЗУМНИХ ДУБЛІКАТІВ ТА КЛОНІВ У БАЗІ SUPABASE
//     // ========================================================
//     console.log(
//       `[ФЛОУ 🧱] Перевірка бази даних на наявність дублікатів за хешем...`,
//     );
//     const duplicateResult = await checkFileHashOnly(supabase, {
//       fileHash,
//       subjectId,
//       schoolClass,
//       programId,
//     });

//     if (duplicateResult.isDuplicate) {
//       console.log(
//         "🎯 [ДЕДУПЛІКАЦІЯ УСПІХ] Книгу розпізнано! Обриваємо ШІ-пайплайн.",
//       );
//       if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//       return NextResponse.json({
//         success: true,
//         status: "DUPLICATE",
//         data: duplicateResult.data,
//       });
//     }

//     // ========================================================
//     // 🚀 КРОК 4: ВИКЛИК ТВОГО ОФІЦІЙНОГО ХЕЛПЕРА (СТРІМ У ЛАМУ ЗА ДОКАМИ)
//     // ========================================================
//     // Передаємо абсолютний шлях до файлу для стабільності на Windows
//     const absolutePath = path.resolve(tempFilePath);

//     console.log("⏳ Передаємо керування файлом в llama-parser...");
//     const llamaRes = await uploadBookToLlamaCloudStream(
//       absolutePath,
//       file.name,
//     );

//     // 🗑️ ✨ ВИПРАВЛЕНО: Блок fs.unlinkSync звідси ПОВНІСТЮ ВИДАЛЕНО!
//     // Файл видалить сам хелпер строго після того, як Лама прийме весь потік.

//     if (!llamaRes.success || !llamaRes.llamaFileId) {
//       throw new Error(
//         llamaRes.error ||
//           "Не вдалося отримати валідний ID задачі від LlamaCloud.",
//       );
//     }

//     const finalYear =
//       pdfMeta.detectedYear !== 1111
//         ? pdfMeta.detectedYear
//         : new Date().getFullYear();

//     return NextResponse.json({
//       success: true,
//       status: "PROCESSING",
//       llamaFileId: llamaRes.llamaFileId,
//       fileName: file.name,
//       fileHash,
//       detectedYear: finalYear,
//     });
//   } catch (error: any) {
//     console.error("❌ [КРИТИЧНИЙ ЗБІЙ ПАЙПЛАЙНУ РОУТУ]:", error.message);

//     // Залишаємо очищення ТІЛЬКИ у разі помилки валідації/бази, щоб диск був чистим
//     if (fs.existsSync(tempFilePath)) {
//       try {
//         fs.unlinkSync(tempFilePath);
//       } catch (e) {}
//     }

//     const isValidationError =
//       error.message?.includes("🚨") || error.message?.includes("не збігається");
//     return NextResponse.json(
//       {
//         success: false,
//         error: error.message || "Помилка ініціалізації підручника.",
//       },
//       { status: isValidationError ? 422 : 500 },
//     );
//   }
// }
