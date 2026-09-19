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
import { checkAndRegisterBook } from "@/app/dashboard/actions";

// Локальний інтерфейс пропсів згідно з правилом 3 Паспорту проєкту
interface UploadBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  schoolClass: number;
  subjectId: string;
  programId: string | null;
  onSuccess?: (newBook: {
    id: string;
    title: string;
    publisher: string | null;
    publishing_year: number | null;
  }) => void;
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
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsPending] = useState(false);
  const [fileHash, setFileHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const fileInputId = useId();

  if (!isOpen) return null;

  // Обробка перетягування файлу (Drag & Drop)
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

  // Клієнтська дедуплікація: прорахунок криптографічного відбитку через утиліту
  const handleTriggerHashing = async () => {
    if (!file) return;
    setIsPending(true);
    setErrorMessage("");
    setFileHash("");

    try {
      // 1. Обчислюємо SHA-256 відбиток на клієнті
      const computedHash = await calculateFileSHA256(file);
      setFileHash(computedHash);

      // 2. Читаємо файл як Base64-рядок для безпечної передачі через Server Action
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onloadend = async () => {
        const base64Result = reader.result as string;
        const cleanBase64 = base64Result.split(",")[1]; // Беремо чистий base64 без префікса

        // 3. Викликаємо серверний екшен дедуплікації
        const res = await checkAndRegisterBook({
          fileHash: computedHash,
          subjectId: subjectId,
          schoolClass: schoolClass,
          programId: programId,
          fileName: file.name,
          fileBase64: cleanBase64,
        });

        if (res.success && res.data) {
          // Передаємо об'єкт нової книги на дашборд! Саме це очікує setBooks
          if (onSuccess) {
            onSuccess(res.data);
          }
        } else {
          setErrorMessage(
            res.error || "Не вдалося зберегти підручник на сервері.",
          );
        }
      };
    } catch (err) {
      console.error("Помилка процесу завантаження:", err);
      setErrorMessage("Сталася критична помилка під час обробки файлу.");
    } finally {
      setIsPending(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* М'яка напівпрозора підкладка (Overlay) */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Головне вікно (Dialog Content) з гнучкою висотою h-auto та WCAG-переносами */}
      <div className="bg-white border-2 border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left h-auto max-h-[95vh] flex flex-col">
        {/* Хедер вікна */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div>
            <h3
              id="modal-title"
              className="font-black text-base text-slate-900 tracking-tight break-words whitespace-normal"
            >
              ➕ Додати новий підручник
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider break-words whitespace-normal">
              {subjectName} • {schoolClass} Клас
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95 cursor-pointer focus-visible:outline-none"
            aria-label="Закрити вікно"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Тіло вікна з великою інтерактивною Drop-зоною */}
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
                  : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
            }`}
          >
            {/* Прихований рідний input */}
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
                  <p className="text-xs font-black text-slate-700 break-words whitespace-normal">
                    Перетягніть PDF-підручник сюди або{" "}
                    <span className="text-sky-700 underline">
                      оберіть на комп'ютері
                    </span>
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                    Максимальний розмір файлу: 45 МБ
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pointer-events-none animate-in fade-in zoom-in-95">
                <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
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

          {/* Інформація про успішний прорахунок унікального хешу */}
          {fileHash && !isProcessing && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Цифровий відбиток згенеровано! Книга готова до перевірки.
                </span>
              </div>
              <p
                className="text-[10px] font-mono bg-white/70 p-2 rounded border border-emerald-100 truncate select-all text-slate-600"
                title={fileHash}
              >
                SHA-256: {fileHash}
              </p>
            </div>
          )}

          {/* Блок відображення виникнення помилок */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span className="break-words whitespace-normal">
                {errorMessage}
              </span>
            </div>
          )}
        </div>

        {/* Нижній блок дій зі шляхетними кнопками без фіолетового кольору */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-1/3 py-3 border-2 border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center active:scale-[0.98] disabled:opacity-50"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={handleTriggerHashing}
            disabled={!file || isProcessing}
            className="w-full sm:w-2/3 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition cursor-pointer text-center flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Обчислюємо відбиток...</span>
              </>
            ) : fileHash ? (
              <span>Перевірити повторно</span>
            ) : (
              <span>Перевірити унікальність книги</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
