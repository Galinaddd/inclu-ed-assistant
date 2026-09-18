"use client";

import React, { useState } from "react";
import { X, UploadCloud, FileText, Loader2 } from "lucide-react";

interface UploadBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  schoolClass: number;
}

export default function UploadBookModal({
  isOpen,
  onClose,
  subjectName,
  schoolClass,
}: UploadBookModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsPending] = useState(false);

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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        alert("Будь ласка, завантажте файл у форматі PDF.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleTriggerHashing = () => {
    if (!file) return;
    setIsPending(true);
    // 🌟 Наступним кроком сюди стане наш скрипт розрахунку SHA-256
    setTimeout(() => {
      setIsPending(false);
      alert(`Файл ${file.name} готовий до прорахунку цифрового відбитку!`);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* М'яка напівпрозора підкладка (Overlay) */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Головне вікно (Dialog Content) */}
      <div className="bg-white border-2 border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Хедер вікна */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-black text-base text-slate-900 tracking-tight">
              ➕ Додати новий підручник
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
              {subjectName} • {schoolClass} Клас
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transitionactive:scale-95 cursor-pointer focus-visible:ring-4 focus-visible:ring-slate-200"
            aria-label="Закрити вікно"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Тіло вікна з великою інтерактивною Drop-зоною */}
        <div className="p-6 space-y-5">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all relative ${
              dragActive
                ? "border-indigo-500 bg-indigo-50/30 scale-[1.01]"
                : file
                  ? "border-emerald-500 bg-emerald-50/10"
                  : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
            }`}
          >
            <input
              type="file"
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
                    <span className="text-indigo-600 underline">
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
        </div>

        {/* Нижній блок дій з великими преміальними кнопками */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-1/3 py-3 border-2 border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center active:scale-[0.98] disabled:opacity-50"
          >
            Скасувати
          </button>
          <button
            onClick={handleTriggerHashing}
            disabled={!file || isProcessing}
            className="w-full sm:w-2/3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition cursor-pointer text-center flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Обчислюємо відбиток...</span>
              </>
            ) : (
              <span>Перевірити унікальність книги</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
