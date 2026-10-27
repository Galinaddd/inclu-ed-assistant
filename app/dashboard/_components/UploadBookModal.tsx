import { createClient } from "@supabase/supabase-js";
import React, { useState, useId, useRef, useEffect } from "react";
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
  checkLlamaStatusAndCommitAction, // Етап 4 опитування статусу черги ШІ
} from "@/app/dashboard/upload/actions";

import { BookData } from "@/app/utils/supabase/upload-helpers";

interface UploadBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  schoolClass: number;
  subjectId: string;
  programId: string | null;
  onSuccess?: (newBook: BookData) => void;
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

  // 🛠️ Посилання на прихований input для гарантованого очищення від залишків файлів
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 🛠️ Зберігаємо ID інтервалу для запобігання витоку пам'яті
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputId = useId();

  // 🧹 ФУНКЦІЯ ПОВНОГО ОЧИЩЕННЯ СТЕЙТІВ ВІД СМІТТЯ
  const handleResetModalState = () => {
    // Зупиняємо таймер, якщо він крутився
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setFile(null);
    setFileHash("");
    setIsPending(false);
    setErrorMessage("");
    setLoadingStage("");
    setSecondsElapsed(0);
    setDragActive(false);

    // Скидаємо значення інпуту у DOM, щоб можна було вибрати той самий файл повторно
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 🛡️ БЕЗПЕЧНЕ ЗАКРИТТЯ МОДАЛКИ (Викликати на хрестик / кнопку скасування)
  const handleSafeClose = () => {
    if (isProcessing) return; // Не даємо закрити під час активного завантаження
    handleResetModalState();
    onClose();
  };

  // Автоматичне підчищення таймера, якщо компонент розмонтується в процесі роботи
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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
      // ========================================================
      // 🛫 КРОК 1: ОБЧИСЛЕННЯ ХЕШУ ТА КЛІЄНТСЬКА НАРІЗКА ПРЕВ'Ю
      // ========================================================
      setLoadingStage("Вирахування цифрового відбитку файлу (SHA-256)...");
      const computedHash = await calculateFileSHA256(file);
      setFileHash(computedHash);

      setLoadingStage(
        "Створення полегшеного прев'ю для верифікації структури...",
      );
      const { PDFDocument } = await import("pdf-lib");
      const fileArrayBuffer = (await file.arrayBuffer()).slice(0);

      const srcDoc = await PDFDocument.load(fileArrayBuffer);
      const pageCount = srcDoc.getPageCount();
      if (pageCount > 5) {
        for (let i = pageCount - 1; i >= 5; i--) {
          srcDoc.removePage(i);
        }
      }

      const previewBytes = await srcDoc.save();
      const miniPreviewBlob = new Blob([new Uint8Array(previewBytes)], {
        type: "application/pdf",
      });
      const miniPreviewFile = new File([miniPreviewBlob], file.name, {
        type: "application/pdf",
      });

      // ========================================================
      // 🛡️ КРОК 2: СУВOРА ВАЛІДАЦІЯ ПРЕВ'Ю НА РОУТІ (ЗАХИСТ ВІД СМІТТЯ)
      // ========================================================
      setLoadingStage(
        "Запуск крос-валідації метаданих та перевірка дублікатів у базі...",
      );

      const routePayload = new FormData();
      routePayload.append("file", miniPreviewFile);
      routePayload.append("originalName", file.name);
      routePayload.append("fileHash", computedHash);
      routePayload.append("subjectId", subjectId);
      routePayload.append("schoolClass", String(schoolClass));
      routePayload.append("subjectName", subjectName);
      if (programId) routePayload.append("programId", programId);

      const routeResponse = await fetch("/dashboard/upload", {
        method: "POST",
        body: routePayload,
      });
      if (!routeResponse.ok) {
        const errorData = await routeResponse.json();
        throw new Error(
          errorData.error || "Файл не пройшов серверний контроль метаданих.",
        );
      }

      const routeResult = await routeResponse.json();
      if (routeResult.status === "DUPLICATE") {
        clearInterval(timerInterval);
        setLoadingStage(`💡 Цей підручник вже є в системі! Підключаємо...`);
        setTimeout(() => {
          if (onSuccess && routeResult.data) onSuccess(routeResult.data);
          setIsPending(false);
          setFile(null);
          onClose();
        }, 5000);
        return;
      }

      // ========================================================
      // 🛫 КРОК 3: ЗАВАНТАЖЕННЯ ОРИГІНАЛУ В CLOUDFLARE R2
      // ========================================================
      setLoadingStage(
        "Книга перевірена. Отримання токену хмари Cloudflare R2...",
      );

      // Виклик твого Server Action для генерації лінку
      const r2TokenRes = await generatePresignedR2UrlAction(
        file.name,
        computedHash,
      );
      if (
        !r2TokenRes ||
        !r2TokenRes.success ||
        !r2TokenRes.uploadUrl ||
        !r2TokenRes.fileKey
      ) {
        throw new Error(
          r2TokenRes?.error || "Не вдалося згенерувати токен доступу до R2.",
        );
      }

      const { uploadUrl, fileKey } = r2TokenRes;

      setLoadingStage(
        "Пряме безпечне завантаження оригінальної книги в Cloudflare R2...",
      );
      const r2UploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!r2UploadResponse.ok)
        throw new Error("Не вдалося завантажити оригінальний файл в R2.");

      // ========================================================
      // 🚀 🔥 КРОК 4: РЕЄСТРАЦІЯ В ЛАМИ ТА ЕФЕКТИВНИЙ ПОЛІНГ СТАТУСУ
      // ========================================================
      setLoadingStage(
        "Ініціалізація нейромережі Llama Cloud через транзит зі сховища R2...",
      );

      const registerPayload = new FormData();
      registerPayload.append("fileKey", fileKey);
      registerPayload.append("fileHash", computedHash);
      registerPayload.append("originalName", file.name);
      registerPayload.append("subjectId", subjectId);
      registerPayload.append("schoolClass", String(schoolClass));
      if (programId) registerPayload.append("programId", programId);

      const registerResponse = await fetch("/dashboard/upload", {
        method: "POST",
        body: registerPayload,
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        throw new Error(
          errorData.error || "Бекенд не зміг ініціювати транзит в Llama Cloud.",
        );
      }

      const registerResult = await registerResponse.json();
      const serverLlamaJobId = registerResult.llamaFileId;

      if (registerResult.status === "PROCESSING") {
        setLoadingStage(
          "Нейромережа Llama Cloud аналізує сторінки підручника та формує структуру параграфів...",
        );

        // 🔄 ЛЕГКИЙ ПОЛІНГ: Чекаємо суворо статус SUCCESS від нашого нового розумного GET-роуту
        const finalData = await new Promise<any>((resolve, reject) => {
          const pollInterval = setInterval(async () => {
            try {
              // 🔥 Передаємо і jobId, і fileHash для автоматичної серверної адаптації
              const res = await fetch(
                `/dashboard/upload?jobId=${serverLlamaJobId}&fileHash=${computedHash}`,
                { method: "GET", cache: "no-store" },
              );
              if (!res.ok)
                throw new Error("Не вдалося отримати статус обробки.");
              const statusData = await res.json();

              if (statusData.status === "SUCCESS") {
                clearInterval(pollInterval);
                resolve(statusData.data); // Забираємо вже збережену й активовану сервером книгу
              } else if (statusData.status === "FAILED") {
                clearInterval(pollInterval);
                reject(
                  new Error(
                    statusData.error ||
                      "ШІ не зміг розпарсити або адаптувати підручник.",
                  ),
                );
              }
            } catch (err) {
              clearInterval(pollInterval);
              reject(err);
            }
          }, 5000);
        });

        // ========================================================
        // 🤖 🎉 ФІНАЛ: УСЕ ЗБЕРЕЖЕНО НА СЕРВЕРІ АВТОМАТИЧНО
        // ========================================================
        clearInterval(timerInterval);
        setLoadingStage(
          "🎉 Підручник успішно розпарсено, розділено на параграфи та збережено!",
        );
        await new Promise((res) => setTimeout(res, 2000));

        if (onSuccess && finalData) onSuccess(finalData);
        setIsPending(false);
        setFile(null);
        onClose();
      } else {
        throw new Error(
          "Сервер повернув неочікуваний статус обробки контенту.",
        );
      }
    } catch (error: any) {
      clearInterval(timerInterval);
      setIsPending(false);
      setErrorMessage(
        error.message || "Сталася помилка під час обробки підручника.",
      );
      console.error("❌ [КРИТИЧНА ПОМИЛКА МОДАЛКИ]:", error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Безпечне закриття по кліку на задній фон */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={handleSafeClose}
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
            onClick={handleSafeClose}
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
              ref={fileInputRef} // 🔥 Додано посилання для повного очищення інпуту від сміття у DOM
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
            onClick={handleSafeClose} // 🔥 Замінено на безпечне очищення перед закриттям
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
