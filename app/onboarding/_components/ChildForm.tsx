"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { childFormSchema } from "./schema";
import { Button } from "@/components/ui/button";

interface ChildFormProps {
  role: "teacher" | "parent";
  diagnosesList: any[];
  supportLevelsList: any[];
  programsList: any[];
  loadingRefs: boolean;
  submitLoading: boolean;
  onBack: () => void;
  onComplete: (data: any) => void;
  initialValues: {
    childProfile: string | null;
    supportLevel: number | null;
    childAge: string;
    schoolClass: string;
    programId: string | null;
  };
  onChangeValues: (vals: any) => void;
}

export default function ChildForm({
  role,
  diagnosesList,
  supportLevelsList,
  programsList,
  loadingRefs,
  submitLoading,
  onBack,
  onComplete,
  initialValues,
  onChangeValues,
}: ChildFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(childFormSchema),
    defaultValues: {
      childName: "", // Початкове порожнє поле для імені
      childAge: initialValues.childAge || "7",
      schoolClass: initialValues.schoolClass || "1",
      childProfile: initialValues.childProfile || "",
      supportLevel: initialValues.supportLevel
        ? String(initialValues.supportLevel)
        : "3", // Передаємо як рядок для стабільності селектора
      programId: initialValues.programId || "",
    },
  });

  const selectedProfile = watch("childProfile");
  const selectedProgram = watch("programId");
  const selectedSupport = watch("supportLevel");

  const onSubmit = (data: any) => {
    onComplete({
      childName: data.childName.trim(), // Передаємо вписане ім'я наверх сторінки
      childProfile: data.childProfile,
      supportLevel: data.supportLevel, // Zod-схема сама трансформує це в число
      childAge: data.childAge,
      schoolClass: data.schoolClass,
      programId: data.programId || null,
    });
  };

  const groupsMap: Record<
    string,
    { title: string; sort_order: number; items: any[] }
  > = {};
  diagnosesList.forEach((diag: any) => {
    const groupInfo = diag.ref_diagnosis_groups;
    const gId = diag.group_id || "OTHER";
    const gTitle = groupInfo?.title || "ІНШЕ";
    const gOrder = groupInfo?.sort_order || 99;

    if (!groupsMap[gId]) {
      groupsMap[gId] = { title: gTitle, sort_order: gOrder, items: [] };
    }
    groupsMap[gId].items.push(diag);
  });
  const sortedGroups = Object.entries(groupsMap).sort(
    (a, b) => a[1].sort_order - b[1].sort_order,
  );
  const currentLevel = supportLevelsList.find(
    (l) => Number(l.level_number) === Number(selectedSupport),
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-xl bg-white border-2 border-slate-200 p-5 md:p-8 rounded-3xl shadow-sm space-y-6 text-left animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="w-full flex gap-3" aria-hidden="true">
        <div className="h-2 flex-1 bg-emerald-700 rounded-full" />
        <div className="h-2 flex-1 bg-emerald-700 rounded-full animate-pulse" />
      </div>

      <div className="text-center space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3 py-1 rounded-md inline-block">
          Крок 2. Особливості учня
        </span>
        <h2 className="text-xl font-black text-slate-900">
          Налаштування профілю навчання
        </h2>
      </div>

      {loadingRefs ? (
        <div
          className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse"
          role="status"
        >
          ⏳ Завантаження довідників МОН...
        </div>
      ) : (
        <div className="space-y-5">
          {/* 👶 ПОЛЕ ВВОДУ: ІМ'Я ДИТИНИ / УЧНЯ */}
          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
              {role === "parent" ? "Ім'я вашої дитини:" : "ПІБ або ім'я учня:"}
            </label>
            <input
              {...register("childName")}
              type="text"
              placeholder={
                role === "parent"
                  ? "Наприклад: Максим, Софія..."
                  : "Наприклад: Учень 1, Артем К..."
              }
              disabled={submitLoading}
              className="w-full rounded-xl border-2 border-slate-200 p-2.5 text-xs font-bold text-slate-900 focus:border-emerald-700 outline-none bg-white transition"
            />
            {errors.childName && (
              <p className="text-[10px] text-rose-600 font-bold">
                {String(errors.childName.message)}
              </p>
            )}
          </div>

          {/* Сітка Віку та Класу */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                Вік дитини (5-18):
              </label>
              <input
                {...register("childAge")}
                type="number"
                min={5}
                max={18}
                disabled={submitLoading}
                onChange={(e) => {
                  setValue("childAge", e.target.value);
                  onChangeValues({ childAge: e.target.value });
                }}
                className="w-full rounded-xl border-2 border-slate-200 p-2.5 text-xs font-bold text-slate-900 focus:border-emerald-700 outline-none bg-white transition"
              />
              {errors.childAge && (
                <p className="text-[10px] text-rose-600 font-bold">
                  {String(errors.childAge.message)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                Шкільний клас (1-11):
              </label>
              <input
                {...register("schoolClass")}
                type="number"
                min={1}
                max={11}
                disabled={submitLoading}
                onChange={(e) => {
                  setValue("schoolClass", e.target.value);
                  onChangeValues({ schoolClass: e.target.value });
                }}
                className="w-full rounded-xl border-2 border-slate-200 p-2.5 text-xs font-bold text-slate-900 focus:border-emerald-700 outline-none bg-white transition"
              />
              {errors.schoolClass && (
                <p className="text-[10px] text-rose-600 font-bold">
                  {String(errors.schoolClass.message)}
                </p>
              )}
            </div>
          </div>
          {/* 1. Категорія труднощів (Діагноз) */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
              1. Категорія сприйняття або труднощів дитини:
            </label>
            <select
              {...register("childProfile")}
              value={selectedProfile}
              disabled={submitLoading}
              onChange={(e) => {
                setValue("childProfile", e.target.value);
                onChangeValues({ childProfile: e.target.value || null });
              }}
              className="w-full rounded-xl border-2 border-slate-200 p-3 text-xs font-bold text-slate-900 focus:border-emerald-700 outline-none bg-white transition cursor-pointer"
            >
              <option value="">-- Оберіть особливість із бази даних --</option>
              {sortedGroups.map(([groupId, group]) => (
                <optgroup key={groupId} label={group.title}>
                  {group.items.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.childProfile && (
              <p className="text-[10px] text-rose-600 font-bold">
                {String(errors.childProfile.message)}
              </p>
            )}
          </div>

          {/* 2. Вибір освітньої програми НУШ */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
              2. Освітня програма (НУШ або інша):
            </label>
            <select
              {...register("programId")}
              value={selectedProgram || ""}
              disabled={submitLoading}
              onChange={(e) => {
                setValue("programId", e.target.value);
                onChangeValues({ programId: e.target.value || null });
              }}
              className="w-full rounded-xl border-2 border-slate-200 p-3 text-xs font-bold text-slate-900 focus:border-emerald-700 outline-none bg-white transition cursor-pointer"
            >
              <option value="">-- Оберіть освітню програму дитини --</option>
              {programsList?.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.title}
                </option>
              ))}
            </select>
            {errors.programId && (
              <p className="text-[10px] text-rose-600 font-bold">
                {String(errors.programId.message)}
              </p>
            )}
          </div>

          {/* 3. Офіційний рівень підтримки МОН */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
              3. Офіційний рівень підтримки МОН:
            </label>
            <select
              {...register("supportLevel")}
              value={selectedSupport}
              disabled={submitLoading}
              onChange={(e) => {
                setValue("supportLevel", e.target.value);
                onChangeValues({
                  supportLevel: e.target.value
                    ? parseInt(e.target.value, 10)
                    : 3,
                });
              }}
              className="w-full rounded-xl border-2 border-slate-200 p-3 text-xs font-bold text-slate-900 focus:border-emerald-700 outline-none bg-white transition cursor-pointer"
            >
              {supportLevelsList.map((level) => (
                <option
                  key={level.level_number}
                  value={String(level.level_number)}
                >
                  {level.title}
                </option>
              ))}
            </select>

            {currentLevel && (
              <div className="p-3 bg-slate-50/80 border border-slate-100 rounded-xl text-[11px] font-medium text-slate-400 mt-2 animate-in fade-in duration-150">
                {currentLevel.description}
              </div>
            )}
            {errors.supportLevel && (
              <p className="text-[10px] text-rose-600 font-bold">
                {String(errors.supportLevel.message)}
              </p>
            )}
          </div>

          {/* Нижні кнопки контроллери */}
          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={submitLoading}
              onClick={onBack}
              className="py-2.5 px-5 bg-white border-2 border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-xl transition"
            >
              Назад
            </Button>

            <Button
              type="submit"
              disabled={submitLoading}
              className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl border-b-4 border-emerald-900 active:border-b-0 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitLoading ? "Зберігаємо дані..." : "🚀 ЗАПУСТИТИ КАБІНЕТ"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
