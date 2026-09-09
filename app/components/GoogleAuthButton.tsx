"use client";

import React from "react";
import { GoogleBrandIcon } from "./graphics/Icons";

interface GoogleAuthButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loadingText?: string;
  defaultText?: string;
}

export default function GoogleAuthButton({
  onClick,
  disabled = false,
  loadingText = "Запуск...",
  defaultText = "Продовжити з Google",
}: GoogleAuthButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Увійти за допомогою вашого облікового запису Google"
      /* 📱 Мобільна адаптивність: h-12 на смартфонах автоматично стає зручною h-14 на великих екранах */
      className="w-full inline-flex justify-center items-center gap-3 px-6 h-12 md:h-14 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl md:rounded-2xl shadow-xs transition-all text-sm md:text-base border-b-4 border-emerald-900 active:border-b-0 cursor-pointer disabled:opacity-50 active:scale-98"
    >
      <GoogleBrandIcon />
      <span>{disabled ? loadingText : defaultText}</span>
    </button>
  );
}
