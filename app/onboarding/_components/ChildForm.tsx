"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { childFormSchema, ChildFormValues } from "./schema";

// Офіційні інклюзивні імпорти компонентів з папки ui вашого проєкту
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ReferenceItem {
  code?: string;
  level_number?: number;
  title: string;
  description: string;
  group_id?: string;
  ref_diagnosis_groups?: {
    id: string; // 👈 Додали id сюди
    title: string;
    sort_order: number;
  };
}

interface ChildFormProps {
  role: "teacher" | "parent";
  diagnosesList: ReferenceItem[];
  supportLevelsList: ReferenceItem[];
  loadingRefs: boolean;
  submitLoading: boolean;
  onBack: () => void;
  onComplete: (data: {
    childProfile: string;
    supportLevel: number;
    childAge: number | null;
    schoolClass: number;
  }) => void;

  initialValues: {
    childProfile: string | null;
    supportLevel: number | null;
    childAge: string;
    schoolClass: string;
  };
  onChangeValues: (values: {
    childProfile?: string | null;
    supportLevel?: number | null;
    childAge?: string;
    schoolClass?: string;
  }) => void;
}

export default function ChildForm({
  role,
  diagnosesList,
  supportLevelsList,
  loadingRefs,
  submitLoading,
  onBack,
  onComplete,
  initialValues,
  onChangeValues,
}: ChildFormProps) {
  // Ініціалізація форми зі значеннями за замовчуванням
  const form = useForm<ChildFormValues>({
    resolver: zodResolver(childFormSchema),
    defaultValues: {
      childAge: initialValues.childAge || "7",
      schoolClass: initialValues.schoolClass || "1",
      childProfile: initialValues.childProfile || "",
      supportLevel: initialValues.supportLevel || 3,
    },
  });

  const onSubmit = (data: ChildFormValues) => {
    const finalSupportLevel = data.supportLevel || 3;

    onComplete({
      childProfile: data.childProfile,
      supportLevel: finalSupportLevel,
      childAge: data.childAge ? parseInt(data.childAge, 10) : null,
      schoolClass: data.schoolClass ? parseInt(data.schoolClass, 10) : 1,
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-xl bg-white border-2 border-slate-200 p-5 md:p-8 rounded-3xl shadow-sm space-y-6 text-left animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Адаптивна смуга прогресу */}
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
            {/* Поля Віку та Класу */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="childAge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      Вік дитини (5-18):
                    </FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        type="number"
                        min={5}
                        max={18}
                        onChange={(e) => {
                          field.onChange(e);
                          onChangeValues({ childAge: e.target.value });
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 p-2.5 text-xs font-bold text-slate-900 focus:border-emerald-600 outline-none bg-white transition"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px] text-rose-600 font-bold" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schoolClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      Шкільний клас (1-11):
                    </FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        type="number"
                        min={1}
                        max={11}
                        onChange={(e) => {
                          field.onChange(e);
                          onChangeValues({ schoolClass: e.target.value });
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 p-2.5 text-xs font-bold text-slate-900 focus:border-emerald-600 outline-none bg-white transition"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px] text-rose-600 font-bold" />
                  </FormItem>
                )}
              />
            </div>
            {/* 2. Категорія труднощів (Діагноз) з динамічним групуванням повністю з бази */}
            <FormField
              control={form.control}
              name="childProfile"
              render={({ field }) => {
                // Динамічно групуємо діагнози на основі Join-даних з таблиць
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
                    groupsMap[gId] = {
                      title: gTitle,
                      sort_order: gOrder,
                      items: [],
                    };
                  }
                  groupsMap[gId].items.push(diag);
                });

                // Сортуємо категорії відповідно до sort_order в базі даних
                const sortedGroups = Object.entries(groupsMap).sort(
                  (a, b) => a[1].sort_order - b[1].sort_order,
                );

                return (
                  <FormItem className="space-y-1.5 w-full">
                    <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      1. Категорія сприйняття або труднощів дитини:
                    </FormLabel>
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          onChangeValues({
                            childProfile: e.target.value || null,
                          });
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 p-3 text-xs font-bold text-slate-900 focus:border-emerald-600 outline-none bg-white transition appearance-none cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%%3csvg xmlns='http://w3.org' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 12px center",
                          backgroundSize: "16px",
                        }}
                      >
                        <option value="">
                          -- Оберіть особливість із бази даних --
                        </option>

                        {sortedGroups.map(([groupId, groupData]) => (
                          <optgroup
                            key={groupId}
                            label={groupData.title}
                            className="text-[11px] font-black text-slate-400 mt-2 tracking-wide uppercase bg-slate-50"
                          >
                            {groupData.items.map((diag) => (
                              <option
                                key={diag.code}
                                value={diag.code}
                                className="font-bold text-slate-900 bg-white py-1.5 normal-case"
                              >
                                {diag.title}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </FormControl>

                    {/* Розумна підказка-опис обраного діагнозу */}
                    {field.value &&
                      diagnosesList &&
                      diagnosesList.find((d: any) => d.code === field.value)
                        ?.description && (
                        <p className="text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-100 p-2.5 rounded-xl mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 normal-case leading-relaxed text-left">
                          💡{" "}
                          {
                            diagnosesList.find(
                              (d: any) => d.code === field.value,
                            )?.description
                          }
                        </p>
                      )}

                    <FormMessage className="text-[10px] text-rose-600 font-bold block pt-1" />
                  </FormItem>
                );
              }}
            />

            {/* 3. Офіційний рівень підтримки МОН */}
            <FormField
              control={form.control}
              name="supportLevel"
              render={({ field }) => (
                <FormItem className="space-y-1.5 w-full">
                  <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                    2. Офіційний уровень підтримки МОН:
                  </FormLabel>
                  <FormControl>
                    <select
                      value={field.value || 3}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        field.onChange(val);
                        onChangeValues({ supportLevel: val || 3 });
                      }}
                      className="w-full rounded-xl border-2 border-slate-200 p-3 text-xs font-bold text-slate-900 focus:border-emerald-600 outline-none bg-white transition appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://w3.org' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                        backgroundSize: "16px",
                      }}
                    >
                      <option value="">-- Оберіть рівень підтримки --</option>
                      {supportLevelsList &&
                        supportLevelsList.map((lvl) => (
                          <option
                            key={lvl.level_number}
                            value={lvl.level_number}
                            className="font-medium text-slate-900"
                          >
                            {lvl.title}
                          </option>
                        ))}
                    </select>
                  </FormControl>

                  {/* Розумний опис рівня підтримки з бази */}
                  {field.value &&
                    supportLevelsList &&
                    supportLevelsList.find(
                      (l: any) => l.level_number === field.value,
                    )?.description && (
                      <p className="text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-100 p-2.5 rounded-xl mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 normal-case leading-relaxed text-left">
                        📋{" "}
                        {
                          supportLevelsList.find(
                            (l: any) => l.level_number === field.value,
                          )?.description
                        }
                      </p>
                    )}

                  <FormMessage className="text-[10px] text-rose-600 font-bold" />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Навігаційні кнопки форми */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-3 w-full">
          <Button
            type="button"
            variant="outline"
            disabled={submitLoading}
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-6 text-xs font-bold text-slate-600 rounded-xl border-2 border-slate-200 hover:bg-slate-50 transition active:scale-[0.98]"
          >
            Назад
          </Button>
          <Button
            type="submit"
            disabled={loadingRefs || submitLoading}
            className="flex-1 py-6 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm hover:shadow transition active:scale-[0.98]"
          >
            {submitLoading ? "⏳ Збереження..." : "🚀 Запустити кабінет"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
