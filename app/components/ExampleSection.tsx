"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ExampleSection() {
  // Локальний стан суто для відстеження активної вкладки
  const [currentTab, setCurrentTab] = useState("simple");

  return (
    <section
      className="max-w-6xl mx-auto px-4 md:px-6 py-8 relative z-10 w-full"
      aria-labelledby="demo-heading"
    >
      <div className="border-2 border-slate-300 rounded-3xl bg-white p-5 md:p-8 shadow-xs">
        {/* БЛОК 1: Картка супроводу уроку за стандартами МОН */}
        <div className="mb-6 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl">
          <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-wider mb-3 flex items-center gap-2">
            📋 Картка педагогичного супроводу уроку
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs md:text-sm font-bold text-slate-700">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-medium mb-0.5">
                🧒 Цільовий вік:
              </span>
              7–9 років (Початкова школа / 2–3 клас НУШ)
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-medium mb-0.5">
                🧬 Профіль дитини:
              </span>
              Розлади автистичного спектра (РАС) або СДУГ
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-medium mb-0.5">
                🎯 Рівень підтримки МОН:
              </span>
              III рівень (Потребує адаптації матеріалу)
            </div>
          </div>
        </div>

        {/* БЛОК 2: Інтерактивний ШІ-генератор контенту */}
        <Tabs
          defaultValue="simple"
          onValueChange={(val) => setCurrentTab(val)}
          className="w-full flex flex-col items-start gap-6"
        >
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b-2 border-slate-100 pb-6 w-full">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-sky-700 bg-sky-100 px-3 py-1 rounded-md">
                Приклад ШІ-адаптації
              </span>
              <h2
                id="demo-heading"
                className="text-xl md:text-2xl font-black text-[#0F172A] mt-2"
              >
                Тема: Як рослини їдять? (Фотосинтез)
              </h2>
            </div>

            {/* ПАНЕЛЬ КНОПОК: Повністю очищена від інлайн-стилів, кольори вирівняні за ТЗ */}
            <div className="w-full xl:w-auto overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="bg-[#FAF9F6] p-1.5 rounded-2xl border-2 border-slate-200 min-w-[500px] sm:min-w-0 flex w-full h-auto gap-1">
                {/* Вкладка 1: Спрощений текст (Колір: Ваше Небо sky-400/40) */}
                <TabsTrigger
                  value="simple"
                  className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-0 cursor-pointer data-[state=active]:bg-sky-400/40 data-[state=active]:text-sky-950 text-slate-600 hover:bg-slate-100"
                >
                  📖 Спрощений текст
                </TabsTrigger>

                {/* Вкладка 2: Покрокові картки (Колір: Ваш Смарагд emerald-400/40) */}
                <TabsTrigger
                  value="steps"
                  className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-0 cursor-pointer data-[state=active]:bg-emerald-400/40 data-[state=active]:text-emerald-950 text-slate-600 hover:bg-slate-100"
                >
                  🧱 Покрокові картки
                </TabsTrigger>

                {/* Вкладка 3: Казка-метафора (Колір: Ваш Бурштин amber-400/40) */}
                <TabsTrigger
                  value="story"
                  className="flex-1 text-center py-2.5 text-xs md:text-sm font-black rounded-xl transition-all border-0 cursor-pointer data-[state=active]:bg-amber-400/40 data-[state=active]:text-amber-950 text-slate-600 hover:bg-slate-100"
                >
                  ✨ Казка-метафора
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          {/* БЛОК 3: КОНТЕНТ ВКЛАДОК */}
          <div className="w-full min-h-[280px] sm:min-h-[220px]">
            {/* Контент 1: Спрощений текст */}
            <TabsContent
              value="simple"
              className="space-y-4 max-w-3xl focus-visible:outline-none"
            >
              <p className="text-base md:text-lg text-slate-800 leading-relaxed font-semibold">
                Рослини не вміють ходити в магазин за їжею. Вони готують її самі
                прямо у своєму листі! Цей процес називається{" "}
                <strong className="text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded-md border border-sky-100">
                  фотосинтез
                </strong>
                .
              </p>
              <div className="bg-[#FAF9F6] p-5 rounded-2xl border-2 border-slate-200 space-y-2">
                <p className="font-black text-[#0F172A] text-base">
                  Що потрібно рослині для обіду?
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-sm font-bold text-slate-800">
                  <li className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2 shadow-xs">
                    ☀️ Світло сонця
                  </li>
                  <li className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2 shadow-xs">
                    💧 Вода з коріння
                  </li>
                  <li className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2 shadow-xs">
                    💨 Повітря (газ)
                  </li>
                </ul>
              </div>
            </TabsContent>

            {/* Контент 2: Покрокові картки */}
            <TabsContent
              value="steps"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 focus-visible:outline-none w-full"
            >
              <div className="bg-sky-50 border-2 border-sky-200 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-2xl" aria-hidden="true">
                    1️⃣
                  </span>
                  <h4 className="font-black text-slate-900 text-sm mt-2 mb-1">
                    Корінь п'є воду
                  </h4>
                </div>
                <p className="text-xs font-medium text-slate-700 mt-1">
                  Вода з землі піднімається по стеблу вгору до листочків.
                </p>
              </div>

              <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-2xl" aria-hidden="true">
                    2️⃣
                  </span>
                  <h4 className="font-black text-slate-900 text-sm mt-2 mb-1">
                    Лист ловить сонце
                  </h4>
                </div>
                <p className="text-xs font-medium text-slate-700 mt-1">
                  Зелені листи, як маленькі сонячні батареї, збирають світло.
                </p>
              </div>

              <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-2xl" aria-hidden="true">
                    3️⃣
                  </span>
                  <h4 className="font-black text-slate-900 text-sm mt-2 mb-1">
                    Вдих повітря
                  </h4>
                </div>
                <p className="text-xs font-medium text-slate-700 mt-1">
                  Листочок має маленькі невидимі ротики для вдиху повітря.
                </p>
              </div>

              <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-2xl" aria-hidden="true">
                    4️⃣
                  </span>
                  <h4 className="font-black text-slate-900 text-sm mt-2 mb-1">
                    Обід готовий!
                  </h4>
                </div>
                <p className="text-xs font-medium text-slate-700 mt-1">
                  Сонце, вода та повітря змішуються — рослина отримує корисну
                  їжу.
                </p>
              </div>
            </TabsContent>

            {/* Контент 3: Казка-метафора для домашнього розбору (family flow) */}
            <TabsContent
              value="story"
              className="space-y-4 max-w-3xl focus-visible:outline-none"
            >
              <div className="border-l-4 border-amber-400 bg-amber-50/50 p-4 rounded-r-2xl border-y border-r border-slate-200">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                  🏡 Гілка Батьків (Зона мами):
                </p>
                <p className="text-xs font-medium text-slate-600">
                  Прочитайте дитині цю історію. Ви можете взяти зелений листок
                  кімнатної рослини або деталь LEGO, щоб показати «кухню»
                  наочно.
                </p>
              </div>
              <p className="text-base md:text-lg text-slate-800 leading-relaxed font-semibold">
                Жив-був маленький зелений Листочок. Він був справжнім кухарем!
                Щоранку він прокидався, відкривав свої зелені долоньки назустріч
                Сонечку і казав: «Час готувати обід!».
              </p>
              <p className="text-base md:text-lg text-slate-800 leading-relaxed font-medium">
                Корінь-помічник передавав йому по довгому ліфту-стеблу чисту
                водичку, а сам Листочок ловив промінчики світла. Він змішував їх
                у своїй чарівній каструльці, і так з'являлася смачна їжа, яка
                допомагала всьому дереву рости великим та сильним.
              </p>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </section>
  );
}
