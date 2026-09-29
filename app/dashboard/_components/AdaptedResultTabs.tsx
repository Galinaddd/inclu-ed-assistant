"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";

interface AdaptedResultTabsProps {
  aiResponse: string;
  userRole: "teacher" | "family";
}

// 🛠️ Допоміжна функція для вирізання контенту між технічними тегами ШІ
function extractTagContent(text: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
  const match = text.match(regex);
  return match && match[1] ? match[1].trim() : "";
}

// 🧱 Функція-парсер, яка малює твою кольорову сітку карток і чистить зірочки **
// 🧱 ВИПРАВЛЕНА ФУНКЦІЯ: автоматично розтягує 3 картки на всю ширину екрана
function renderStepCards(rawStepsText: string) {
  if (!rawStepsText)
    return (
      <p className="text-xs text-slate-400">Покрокові інструкції відсутні.</p>
    );

  const lines = rawStepsText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const steps = lines
    .filter(
      (line) =>
        line.startsWith("-") || line.startsWith("*") || /^\d+/.test(line),
    )
    .map((line) => line.replace(/^[-*\s\d.)]+/, "").trim());

  if (steps.length === 0) {
    return (
      <div className="text-sm font-medium text-slate-800 leading-relaxed">
        <ReactMarkdown>{rawStepsText}</ReactMarkdown>
      </div>
    );
  }

  const cardStyles = [
    {
      bg: "bg-sky-50",
      border: "border-sky-200",
      text: "text-slate-900",
      icon: "1️⃣",
    },
    {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-slate-900",
      icon: "2️⃣",
    },
    {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-slate-900",
      icon: "3️⃣",
    },
    {
      bg: "bg-rose-50",
      border: "border-rose-200",
      text: "text-slate-900",
      icon: "4️⃣",
    },
  ];

  // Динамічно визначаємо кількість колонок: якщо кроків 3 — ділимо на 3 рівні частини, інакше на 4
  const gridColsClass =
    steps.length === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${gridColsClass} gap-4 w-full text-left`}>
      {steps.map((stepText, index) => {
        const style = cardStyles[index % cardStyles.length];

        const sentenceEnd =
          stepText.indexOf(".") !== -1
            ? stepText.indexOf(".") + 1
            : stepText.length;
        const heading = stepText
          .substring(0, sentenceEnd)
          .replace(/[.:*]+\$/, "")
          .trim();
        const description = stepText.substring(sentenceEnd).trim();

        return (
          <div
            key={index}
            className={`${style.bg} border-2 ${style.border} p-4 rounded-2xl flex flex-col justify-between shadow-xs min-h-[140px]`}
          >
            <div>
              <span className="text-2xl" aria-hidden="true">
                {style.icon}
              </span>
              <h4 className={`font-black ${style.text} text-sm mt-2 mb-1`}>
                {heading}
              </h4>
            </div>
            {description && (
              <p className="text-xs font-medium text-slate-700 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdaptedResultTabs({
  aiResponse,
  userRole,
}: AdaptedResultTabsProps) {
  const isTeacher = userRole === "teacher";
  const defaultTab = isTeacher ? "notes" : "simple";
  const [currentTab, setCurrentTab] = useState(defaultTab);

  if (!aiResponse) return null;

  // Вирізаємо блоки для Вчителя
  const teacherNotes = extractTagContent(aiResponse, "teacher-notes");
  const teacherExercises = extractTagContent(aiResponse, "teacher-exercises");
  const teacherCriteria = extractTagContent(aiResponse, "teacher-criteria");

  // Вирізаємо блоки для Мами / Лендінгу
  const parentsZone = extractTagContent(aiResponse, "parents-zone");
  const childSimple = extractTagContent(aiResponse, "child-simple");
  const childStory = extractTagContent(aiResponse, "child-story");

  // Автоматично виокремлюємо список кроків для карткової сітки
  const childStepsText =
    extractTagContent(aiResponse, "child-steps") || childSimple;

  const fallbackText = aiResponse;

  return (
    <div className="mt-4 border-2 border-slate-200 rounded-3xl bg-white p-5 md:p-6 shadow-xs w-full text-left animate-in fade-in duration-300">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={(val) => setCurrentTab(val)}
        className="w-full flex flex-col items-start gap-6"
      >
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b-2 border-slate-100 pb-4 w-full">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-3 py-1 rounded-md">
              ✨ Результат інклюзивної адаптації
            </span>
          </div>

          {/* ПАНЕЛЬ КНОПОК ПРЕМІУМ-ДИЗАЙНУ */}
          <div className="w-full xl:w-auto overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="bg-[#FAF9F6] p-1.5 rounded-2xl border-2 border-slate-200 min-w-[500px] sm:min-w-0 flex w-full h-auto gap-1">
              {isTeacher ? (
                <>
                  <TabsTrigger
                    value="notes"
                    style={{
                      backgroundColor:
                        currentTab === "notes" ? "#E0F2FE" : "transparent",
                      borderColor:
                        currentTab === "notes" ? "#38BDF8" : "transparent",
                      color: currentTab === "notes" ? "#0369A1" : "#475569",
                    }}
                    className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-2 cursor-pointer focus:outline-hidden active:scale-95"
                  >
                    📋 Конспект уроку
                  </TabsTrigger>
                  <TabsTrigger
                    value="exercises"
                    style={{
                      backgroundColor:
                        currentTab === "exercises" ? "#E6F4EA" : "transparent",
                      borderColor:
                        currentTab === "exercises" ? "#34A853" : "transparent",
                      color: currentTab === "exercises" ? "#137333" : "#475569",
                    }}
                    className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-2 cursor-pointer focus:outline-hidden active:scale-95"
                  >
                    🧱 Практичні вправи
                  </TabsTrigger>
                  <TabsTrigger
                    value="criteria"
                    style={{
                      backgroundColor:
                        currentTab === "criteria" ? "#FEF3C7" : "transparent",
                      borderColor:
                        currentTab === "criteria" ? "#F59E0B" : "transparent",
                      color: currentTab === "criteria" ? "#B45309" : "#475569",
                    }}
                    className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-2 cursor-pointer focus:outline-hidden active:scale-95"
                  >
                    📝 Оцінювання ІПР
                  </TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger
                    value="simple"
                    style={{
                      backgroundColor:
                        currentTab === "simple" ? "#E0F2FE" : "transparent",
                      borderColor:
                        currentTab === "simple" ? "#38BDF8" : "transparent",
                      color: currentTab === "simple" ? "#0369A1" : "#475569",
                    }}
                    className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-2 cursor-pointer focus:outline-hidden active:scale-95"
                  >
                    📋 Спрощений текст
                  </TabsTrigger>

                  <TabsTrigger
                    value="steps"
                    style={{
                      backgroundColor:
                        currentTab === "steps" ? "#E6F4EA" : "transparent",
                      borderColor:
                        currentTab === "steps" ? "#34A853" : "transparent",
                      color: currentTab === "steps" ? "#137333" : "#475569",
                    }}
                    className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-2 cursor-pointer focus:outline-hidden active:scale-95"
                  >
                    🧱 Покрокові картки
                  </TabsTrigger>

                  <TabsTrigger
                    value="story"
                    style={{
                      backgroundColor:
                        currentTab === "story" ? "#FEF3C7" : "transparent",
                      borderColor:
                        currentTab === "story" ? "#F59E0B" : "transparent",
                      color: currentTab === "story" ? "#B45309" : "#475569",
                    }}
                    className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-2 cursor-pointer focus:outline-hidden active:scale-95"
                  >
                    ✨ Казка-метафора
                  </TabsTrigger>

                  <TabsTrigger
                    value="parents"
                    style={{
                      backgroundColor:
                        currentTab === "parents" ? "#FAF0E6" : "transparent",
                      borderColor:
                        currentTab === "parents" ? "#CD853F" : "transparent",
                      color: currentTab === "parents" ? "#8B4513" : "#475569",
                    }}
                    className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-2 cursor-pointer focus:outline-hidden active:scale-95"
                  >
                    💡 Поради батькам
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>
        </div>

        {/* НАПОВНЕННЯ КОНТЕНТОМ */}
        <div className="w-full min-h-[150px] text-left">
          {isTeacher ? (
            <>
              <TabsContent
                value="notes"
                className="focus-visible:outline-none max-w-none"
              >
                <div className="text-sm font-medium text-slate-800 leading-relaxed space-y-3">
                  <ReactMarkdown>{teacherNotes || fallbackText}</ReactMarkdown>
                </div>
              </TabsContent>
              <TabsContent
                value="exercises"
                className="focus-visible:outline-none"
              >
                <div className="p-5 bg-sky-50/50 border-2 border-sky-200 rounded-2xl text-sm font-medium text-slate-800 leading-relaxed space-y-3">
                  <ReactMarkdown>
                    {teacherExercises || "Вправи не згенеровані."}
                  </ReactMarkdown>
                </div>
              </TabsContent>
              <TabsContent
                value="criteria"
                className="focus-visible:outline-none"
              >
                <div className="p-5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-sm font-medium text-slate-800 leading-relaxed space-y-3">
                  <ReactMarkdown>
                    {teacherCriteria || "Критерії оцінювання відсутні."}
                  </ReactMarkdown>
                </div>
              </TabsContent>
            </>
          ) : (
            <>
              <TabsContent
                value="simple"
                className="focus-visible:outline-none max-w-none"
              >
                <div className="text-sm font-medium text-slate-800 leading-relaxed space-y-3">
                  <ReactMarkdown>{childSimple || fallbackText}</ReactMarkdown>
                </div>
              </TabsContent>

              <TabsContent
                value="steps"
                className="focus-visible:outline-none w-full"
              >
                {renderStepCards(childStepsText)}
              </TabsContent>

              <TabsContent value="story" className="focus-visible:outline-none">
                <div className="p-5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl text-sm font-medium text-slate-800 leading-relaxed space-y-3">
                  <ReactMarkdown>
                    {childStory || "Ігрова казка не згенерована ШІ."}
                  </ReactMarkdown>
                </div>
              </TabsContent>

              <TabsContent
                value="parents"
                className="focus-visible:outline-none"
              >
                <div className="p-5 bg-emerald-50/50 border-2 border-emerald-200 rounded-2xl text-sm font-medium text-slate-800 leading-relaxed space-y-3">
                  <ReactMarkdown>
                    {parentsZone || "Поради для розбору теми відсутні."}
                  </ReactMarkdown>
                </div>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
