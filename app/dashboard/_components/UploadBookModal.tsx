// 📂 Шлях до файлу: app/dashboard/_components/UploadBookModal.tsx
"use client";

import React, { useState, useId } from "react";
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { calculateFileSHA256 } from "@/app/utils/crypto";
import {
  verifyBookMetadataAction, // Наш новий Етап 1 перевірок
  generatePresignedR2UrlAction, // Новий Етап 2 створення лінку R2
  startLlamaParsingAction,
  checkLlamaStatusAndCommitAction,
} from "@/app/dashboard/actions";

import { BookData } from "@/app/utils/supabase/upload-helpers";

interface UploadBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  schoolClass: number;
  subjectId: string;
  programId: string | null;
  onSuccess?: (newBook: BookData) => void; // ✨ ВИПРАВЛЕНО: Тепер типи ідеально збігаються з екшеном!
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function UploadBookModal({
  isOpen,
  onClose,
  subjectName,
  schoolClass,
  subjectId,
  programId,
  onSuccess,
}: UploadBookModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsPending] = useState(false);
  const [fileHash, setFileHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  const fileInputId = useId();

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMessage("");
    setFileHash("");

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        setErrorMessage("Будь ласка, завантажте файл у форматі PDF.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    setFileHash("");
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else {
        setErrorMessage("Будь ласка, оберіть файл у форматі PDF.");
      }
    }
  };

  const handleTriggerHashing = async () => {
    if (!file) return;
    setIsPending(true);
    setErrorMessage("");
    setFileHash("");
    setSecondsElapsed(0);

    const timerInterval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    try {
      // 1. Хешуємо великий файл для майбутньої перевірки на дублікати
      setLoadingStage("Вирахування цифрового відбитку файлу (SHA-256)...");
      const computedHash = await calculateFileSHA256(file);
      setFileHash(computedHash);

      // 2. Нарізаємо легке прев'ю на клієнті, щоб захистити сервер від RAM-крашу
      setLoadingStage(
        "Створення полегшеного прев'ю для верифікації структури...",
      );
      const { PDFDocument } = await import("pdf-lib");
      const fileArrayBuffer = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(fileArrayBuffer);
      const previewDoc = await PDFDocument.create();

      const pagesToCopy = Math.min(5, srcDoc.getPageCount());
      const pageIndices = Array.from({ length: pagesToCopy }, (_, i) => i);
      const copiedPages = await previewDoc.copyPages(srcDoc, pageIndices);

      copiedPages.forEach((page: any) => previewDoc.addPage(page));

      const previewBytes = await previewDoc.save();

      // Конвертуємо Uint8Array у Buffer для 100% сумісності з типами BlobPart
      const miniPreviewBlob = new Blob([Buffer.from(previewBytes)], {
        type: "application/pdf",
      });
      const miniPreviewFile = new File([miniPreviewBlob], "mini-preview.pdf", {
        type: "application/pdf",
      });

      // 3. Пакуємо payload та викликаємо ЕТАП 1: Ізольований ланцюжок перевірок НУШ
      setLoadingStage(
        "Перевірка освітньої програми, дисципліни та наявності в базі...",
      );
      const startPayload = new FormData();
      startPayload.append("file", miniPreviewFile);
      startPayload.append("originalName", file.name); // Справжнє ім'я оригінальної книги
      startPayload.append("fileHash", computedHash);
      startPayload.append("subjectId", subjectId);
      startPayload.append("schoolClass", String(schoolClass));
      startPayload.append("subjectName", subjectName);
      if (programId) startPayload.append("programId", programId);

      // Викликаємо наш новий розділений екшен (Ламу та R2 тут не чіпаємо!)
      const startRes = await verifyBookMetadataAction(startPayload);

      if (!startRes || !startRes.success) {
        throw new Error(
          startRes?.error || "Файл не пройшов серверні валідації НУШ.",
        );
      }

      // Обробка дубліката (Книга вже є в базі — миттєво підключаємо й виходимо)
      if (startRes.status === "DUPLICATE") {
        clearInterval(timerInterval);
        setLoadingStage(
          `💡 Підручник "${startRes.data?.title || "Обраний файл"}" знайдено в системі! Миттєво підключаємо...`,
        );
        await delay(2500);

        if (onSuccess && startRes.data) onSuccess(startRes.data);
        onClose();
        return;
      }

      // 4. ЕТАП 2: Якщо валідація успішна — генеруємо токен прямого завантаження Cloudflare R2
      if (startRes.status !== "VALIDATED") {
        throw new Error(
          "Неочікуваний статус відповіді сервера після валідації.",
        );
      }

      setLoadingStage(
        "Контроль пройдено успішно. Генерація токену доступу хмари R2...",
      );
      const r2TokenRes = await generatePresignedR2UrlAction(
        startRes.fileName || file.name,
      );

      if (
        !r2TokenRes ||
        !r2TokenRes.success ||
        !r2TokenRes.uploadUrl ||
        !r2TokenRes.fileKey
      ) {
        throw new Error(
          r2TokenRes?.error ||
            "Не вдалося згенерувати параметри доступу до хмари.",
        );
      }

      const { uploadUrl, fileKey } = r2TokenRes;
      const detectedYear = startRes.detectedYear || new Date().getFullYear();

      // 5. Пряме клієнтське завантаження оригінального важкого файлу в Cloudflare R2 повз Next.js
      setLoadingStage(
        "Пряме безпечне завантаження книги в Cloudflare R2 (0MB RAM сервера)...",
      );
      const r2UploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/pdf",
        },
        body: file, // Оригінальний великий файл летить напряму з браузера
      });

      if (!r2UploadResponse.ok) {
        throw new Error(
          "Не вдалося завантажити оригінальний файл у хмарне сховище R2.",
        );
      }

      // Формуємо публічний домен твого R2 сховища
      const r2PublicDomain =
        process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN ||
        "https://your-r2-public-domain.com";
      const r2PublicUrl = `${r2PublicDomain}/${fileKey}`;

      // 6. ЕТАП 3: Запуск асинхронного аналізу в LlamaParse через Server Action
      setLoadingStage("Реєстрація завдання в системі аналізу ШІ...");

      const parseTriggerRes = (await startLlamaParsingAction(
        r2PublicUrl,
        file.name,
      )) as { success: boolean; jobId?: string; error?: string };

      if (
        !parseTriggerRes ||
        !parseTriggerRes.success ||
        !parseTriggerRes.jobId
      ) {
        throw new Error(
          parseTriggerRes?.error ||
            "Не вдалося ініціювати аналіз книги через ШІ.",
        );
      }

      const jobId: string = parseTriggerRes.jobId;

      // 7. ЕТАП 4: Асинхронний цикл опитування черги ШІ
      let isFinished = false;
      let attempts = 0;

      while (!isFinished) {
        if (attempts >= 90) {
          // Ліміт ~7.5 хвилин на велику книгу
          throw new Error(
            "Перевищено ліміт часу очікування ШІ. Будь ласка, спробуйте пізніше.",
          );
        }

        setLoadingStage(
          `ШІ аналізує сторінки книги (очікування: ${secondsElapsed}с)...`,
        );

        await delay(5000);
        attempts++;

        // Опитуємо четвертий Server Action перевірки статусу та фінального комміту в БД
        const checkRes = await checkLlamaStatusAndCommitAction({
          jobId,
          fileHash: computedHash,
          subjectId,
          schoolClass,
          programId,
          detectedYear,
          fileName: file.name,
          fileKey: fileKey,
        });

        if (!checkRes || !checkRes.success) {
          throw new Error(
            checkRes?.error || "Збій під час обробки підручника на сервері.",
          );
        }

        if (checkRes.status === "COMPLETED") {
          isFinished = true;
          clearInterval(timerInterval);
          setLoadingStage("🎉 Книгу успішно оцифровано та збережено!");
          await delay(1500);

          if (onSuccess && checkRes.data) onSuccess(checkRes.data);
          onClose();
          return;
        }
      }
    } catch (serverErr: any) {
      clearInterval(timerInterval);
      setErrorMessage(
        serverErr.message || "Сталася помилка обробки підручника.",
      );
    } finally {
      setIsPending(false);
      setLoadingStage("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="bg-white border-2 border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left h-auto max-h-[95vh] flex flex-col">
        {/* Хедер модалки */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div>
            <h3
              id="modal-title"
              className="font-black text-base text-slate-900 tracking-tight break-words"
            >
              ➕ Додати новий підручник
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
              {subjectName} • {schoolClass} Клас
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95 cursor-pointer"
            aria-label="Закрити вікно"
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Тіло форми */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all relative ${
              dragActive
                ? "border-sky-500 bg-sky-50/30 scale-[1.01]"
                : file
                  ? "border-emerald-500 bg-emerald-50/10"
                  : "border-slate-300 bg-slate-50/50"
            }`}
          >
            <input
              type="file"
              id={fileInputId}
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              disabled={isProcessing}
            />
            {!file ? (
              <div className="space-y-3 pointer-events-none">
                <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mx-auto shadow-xs">
                  <UploadCloud className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-700">
                    Перетягніть PDF-підручник сюди або{" "}
                    <span className="text-sky-700 underline">
                      оберіть на комп'ютері
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pointer-events-none animate-in fade-in zoom-in-95">
                <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                  <span className="text-emerald-600 text-xs font-black">
                    PDF
                  </span>
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {(file.size / (1024 * 1024)).toFixed(2)} МБ
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Цифровий відбиток хешу */}
          {fileHash && !isProcessing && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Цифровий відбиток згенеровано! Книга готова до перевірки.
                </span>
              </div>
              <p className="text-[10px] font-mono bg-white/70 p-2 rounded border border-emerald-100 truncate select-all text-slate-600">
                SHA-256: {fileHash}
              </p>
            </div>
          )}

          {/* Індикатор прогресу стадій та живий лічильник часу */}
          {isProcessing && loadingStage && (
            <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-2 animate-in fade-in duration-200 text-sky-900 text-xs font-bold flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-sky-600 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="break-words whitespace-normal">
                  {loadingStage}
                </span>
                {secondsElapsed > 0 && (
                  <span className="text-[10px] text-sky-600 font-medium mt-0.5">
                    ⏱️ Поточний час аналізу: {secondsElapsed}с
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Виведення помилок валідації чи серверних збоїв */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="break-words whitespace-normal">
                {errorMessage}
              </span>
            </div>
          )}
        </div>

        {/* Нижня панель дій */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-1/3 py-3 border-2 border-slate-200 text-slate-700 bg-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Скасувати
          </button>

          <button
            type="button"
            onClick={handleTriggerHashing}
            disabled={!file || isProcessing}
            className="w-full sm:w-2/3 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 text-white disabled:text-slate-400 font-black text-xs uppercase tracking-wider rounded-xl shadow-md disabled:shadow-none transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                <span>Аналіз підручника...</span>
              </>
            ) : fileHash ? (
              <span>Перезапустити процес</span>
            ) : (
              <span>Оцифрувати та валідувати підручник</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
