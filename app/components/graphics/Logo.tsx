import React from "react";

export default function Logo() {
  return (
    <a
      href="/"
      className="text-xl md:text-2xl font-black tracking-tight hover:opacity-90 transition-opacity focus:outline-none focus:ring-4 focus:ring-sky-600/50 rounded-xl select-none flex items-baseline gap-0.5"
      aria-label="IncluEdAssistant.ai — Головна сторінка платформи інклюзивної освіти"
    >
      {/* Кольори з вашої фірмової палітри з прозорістю /80 */}
      <span className="text-sky-900/80">Inclu</span>
      <span className="text-sky-700/80">Ed</span>
      <span className="text-emerald-700">Assistant</span>
      <span className="text-sky-900 font-medium text-sm">.ai</span>
    </a>
  );
}
