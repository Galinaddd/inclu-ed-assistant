"use client";

import React, { useState, useId, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { calculateFileSHA256 } from "@/app/utils/crypto";
import { generatePresignedR2UrlAction } from "@/app/dashboard/upload/actions";
import { BookData } from "@/app/utils/supabase/upload-helpers";

// Імпортуємо наші три нові винесені компоненти
import { UploadSuccessStage } from "./UploadSuccessStage";
import { FileDropzone } from "./FileDropzone";
import { ProcessingStage } from "./ProcessingStage";

interface UploadBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  schoolClass: number;
  subjectId: string;
  programId: string | null;
  onSuccess?: (newBook: BookData) => void;
}

export default function UploadBookModal({
  isOpen,
  onClose,
  subjectName,
  schoolClass,
  subjectId,
  programId,
  onSuccess,
}: UploadBookModalProps) {
  const router = useRouter();
  const fileInputId = useId();

  // --- СТЕЙТИ КЕРУВАННЯ ФАЙЛОМ ТА ДРАГ-Н-ДРОПОМ ---
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // --- СТЕЙТИ ПРОЦЕСУ ЗАВАНТАЖЕННЯ (Тепер повністю синхронізовані) ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingSuccess, setIsProcessingSuccess] = useState(false);
  const [fileHash, setFileHash] = useState<string>("");
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  // --- РЕФИ ДЛЯ БЕЗПЕКИ ТА ОЧИЩЕННЯ DOM ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 🧹 ФУНКЦІЯ ПОВНОГО ОЧИЩЕННЯ СТЕЙТІВ ВІД СМІТТЯ
  const handleResetModalState = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setFile(null);
    setFileHash("");
    setIsProcessing(false);
    setIsProcessingSuccess(false);
    setErrorMessage("");
    setLoadingStage("");
    setSecondsElapsed(0);
    setDragActive(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 🛡️ БЕЗПЕЧНЕ ЗАКРИТТЯ МОДАЛКИ
  const handleSafeClose = () => {
    if (isProcessing) return;
    handleResetModalState();
    onClose();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- ОБРОБКА ДРАГ-Н-ДРОП ПОДІЙ ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMessage("");
    setFileHash("");
    if (selectedFile.type === "application/pdf") {
      setFile(selectedFile);
    } else {
      setErrorMessage("Будь ласка, завантажте файл у форматі PDF.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  if (!isOpen) return null;
  // ========================================================
  // 🚀 ГОРЯЧИЙ ТРИГЕР "FIRE AND FORGET" ЗАВАНТАЖЕННЯ КНИГИ
  // ========================================================
  const handleTriggerHashing = async () => {
    if (!file) return;
    setIsProcessing(true);
    setIsProcessingSuccess(false);
    setErrorMessage("");
    setFileHash("");
    setSecondsElapsed(0);

    timerRef.current = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    try {
      setLoadingStage("Вирахування цифрового відбитку файлу (SHA-256)...");
      const computedHash = await calculateFileSHA256(file);
      setFileHash(computedHash);

      setLoadingStage(
        "Створення полегшеного прев'ю для верифікації microstructure...",
      );
      const { PDFDocument } = await import("pdf-lib");
      const fileArrayBuffer = (await file.arrayBuffer()).slice(0);

      const srcDoc = await PDFDocument.load(fileArrayBuffer);
      const pageCount = srcDoc.getPageCount();
      if (pageCount > 5) {
        for (let i = pageCount - 1; i >= 5; i--) srcDoc.removePage(i);
      }

      const previewBytes = await srcDoc.save();
      const miniPreviewBlob = new Blob([new Uint8Array(previewBytes)], {
        type: "application/pdf",
      });
      const miniPreviewFile = new File([miniPreviewBlob], file.name, {
        type: "application/pdf",
      });

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
          errorData.error || "Файл не пройшов контроль метаданих.",
        );
      }

      const routeResult = await routeResponse.json();
      if (routeResult.status === "DUPLICATE") {
        if (timerRef.current) clearInterval(timerRef.current);
        setLoadingStage(`💡 Цей підручник вже є в системі! Підключаємо...`);
        setTimeout(() => {
          if (onSuccess && routeResult.data) onSuccess(routeResult.data);
          handleResetModalState();
          onClose();
        }, 4000);
        return;
      }

      setLoadingStage(
        "Книга перевірена. Отримання токену хмари Cloudflare R2...",
      );
      const r2TokenRes = await generatePresignedR2UrlAction(
        file.name,
        computedHash,
      );
      if (
        !r2TokenRes?.success ||
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

      if (registerResult.status === "PROCESSING") {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsProcessingSuccess(true);
        setIsProcessing(false);
        setFile(null);
        router.refresh();
      } else {
        throw new Error(
          "Сервер повернув неочікуваний статус обробки контенту.",
        );
      }
    } catch (error: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsProcessing(false);
      setIsProcessingSuccess(false);
      setErrorMessage(
        error.message || "Сталася помилка під час обробки підручника.",
      );
      console.error("❌ [КРИТИЧНА ПОМИЛКА МОДАЛКИ]:", error);
    }
  };

  // --- СВЯТИЙ JSX ОНОВЛЕНОЇ РОЗМІТКИ ---
  // --- СВЯТИЙ JSX ОНОВЛЕНОЇ ТА ОЧИЩЕНОЇ РОЗМІТКИ ---
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
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
              {isProcessingSuccess
                ? "🎉 Завантаження успішне"
                : "➕ Додати новий підручник"}
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

        {isProcessingSuccess ? (
          /* КРОК 4: Інформаційний екран успіху */
          <UploadSuccessStage
            secondsElapsed={secondsElapsed}
            onClose={onClose}
            onResetSuccessState={handleResetModalState}
          />
        ) : (
          /* СТАНДАРТНА ФОРМА ЗАВАНТАЖЕННЯ ТА ПРОГРЕС БАР */
          <>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* ВИКЛИК ВИДІЛЕНОГО КОМПОНЕНТА ДЛЯ КЛІЄНТСЬКОГО ДРАГ-Н-ДРОПУ */}
              <FileDropzone
                fileInputId={fileInputId}
                fileInputRef={fileInputRef}
                file={file}
                dragActive={dragActive}
                isProcessing={isProcessing}
                handleDrag={handleDrag}
                handleDrop={handleDrop}
                handleFileChange={handleFileChange}
              />

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

              {/* ВИКЛИК ВИДІЛЕНОГО КОМПОНЕНТА ДЛЯ ПРОГРЕСУ СТАДІЙ */}
              <ProcessingStage
                isProcessing={isProcessing}
                loadingStage={loadingStage}
                secondsElapsed={secondsElapsed}
              />

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
                onClick={handleSafeClose}
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
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                    <span>Аналіз підручника...</span>
                  </div>
                ) : fileHash ? (
                  <span>Перезапустити процес</span>
                ) : (
                  <span>Оцифрувати та валідувати підручник</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
