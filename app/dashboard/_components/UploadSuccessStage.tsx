"use client";

import React from "react";
import { CheckCircle2, BookOpen } from "lucide-react";

interface UploadSuccessStageProps {
  secondsElapsed: number;
  onClose: () => void;
  onResetSuccessState?: () => void;
}

export const UploadSuccessStage: React.FC<UploadSuccessStageProps> = ({
  secondsElapsed,
  onClose,
  onResetSuccessState,
}) => {
  const handleFinalClose = () => {
    if (onResetSuccessState) {
      onResetSuccessState();
    }
    onClose();
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      {/* 🟢 М'яка смарагдова іконка успіху, спокійна та тактильна */}
      <div className="flex items-center justify-center w-14 h-14 mb-4 rounded-2xl bg-[oklch(0.95_0.03_155)] text-emerald-active shadow-xs border border-[oklch(0.88_0.04_155)]">
        <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
      </div>

      <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
        Книгу прийнято в обробку
      </h3>

      <p className="mt-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        Час завантаження: {secondsElapsed} сек.
      </p>

      {/* ☀️ Тепле жовтеньке світле повідомлення — м'яке для дитячого сприйняття */}
      <div className="max-w-md mt-5 p-5 rounded-2xl bg-amber-50/70 border-2 border-amber-100 text-left space-y-3">
        <p className="text-sm font-bold leading-relaxed text-amber-900/80">
          Зараз наш сервер у фоновому режимі виконує детальну аналітику:
          розбиває текст на параграфи та оптимізує{" "}
          <strong>понад 475 ілюстрацій</strong>.
        </p>
        <p className="text-sm font-medium leading-relaxed text-amber-800/80">
          ⏳ Це триватиме приблизно <strong>3–7 хвилин</strong>. Ви можете
          спокійно закрити це вікно та займатися іншими справами.
        </p>

        {/* М'яка смарагдова підказка внизу жовтенького блоку */}
        <div className="pt-2 border-t border-amber-200/60 flex items-start gap-2 text-xs font-bold text-emerald-active leading-normal">
          <BookOpen className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Сторінка оновиться самостійно, щойно бекенд завершить роботу.
            Жодного ручного перезавантаження!
          </span>
        </div>
      </div>

      {/* 🌿 Акцентна інклюзивна кнопка у вашому фірмовому смарагдовому кольорі */}
      <button
        onClick={handleFinalClose}
        className="w-full max-w-md mt-6 py-3.5 px-4 font-black text-xs uppercase tracking-wider text-white bg-emerald-active hover:bg-[oklch(0.38_0.14_155)] active:scale-[0.98] rounded-xl shadow-md transition-all duration-150 cursor-pointer focus-visible:outline-[3px] focus-visible:outline-emerald-500"
      >
        Зрозуміло, перейти до книг
      </button>
    </div>
  );
};
