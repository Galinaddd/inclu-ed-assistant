"use client";

import React from "react";
import { FileText, Image, HelpCircle } from "lucide-react";

export type ActiveTabType = "text" | "attachment" | "problem";

interface FormTabsProps {
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
}

export default function FormTabs({ activeTab, setActiveTab }: FormTabsProps) {
  // Конфігурація вкладок: кожна має свій індивідуальний стиль при активації
  const tabs = [
    {
      id: "text",
      label: "Текст параграфа",
      icon: FileText,
      activeClass: "bg-sky-100 border-sky-400 text-sky-950", // Ніжне Небо
    },
    {
      id: "attachment",
      label: "Фото або Документ",
      icon: Image,
      activeClass: "bg-emerald-50 border-emerald-400 text-emerald-950", // Ніжний Смарагд
    },
    {
      id: "problem",
      label: "Питання / Проблема",
      icon: HelpCircle,
      activeClass: "bg-amber-50 border-amber-400 text-amber-950", // Ніжний Бурштин
    },
  ] as const;

  return (
    <div
      className="flex flex-wrap gap-2 border-b border-slate-100 pb-4 shrink-0"
      role="tablist"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border-2 cursor-pointer active:scale-95 focus:outline-hidden ${
              isActive
                ? tab.activeClass // Рендеримо індивідуальний колір для кожної з трьох кнопок
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="break-words whitespace-normal text-left">
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
