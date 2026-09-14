"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roleFormSchema, RoleFormValues } from "./schema";

// Імпорти офіційних компонентів shadcn/ui через відносні шляхи
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../components/ui/form";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

interface RoleFormProps {
  onComplete: (chosenRole: "teacher" | "parent") => void;
  initialRole?: "teacher" | "parent" | null;
}

export default function RoleForm({
  onComplete,
  initialRole = null,
}: RoleFormProps) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      role: initialRole || undefined,
    },
  });

  const onSubmit = (data: RoleFormValues) => {
    onComplete(data.role as "teacher" | "parent");
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-xl bg-white border-2 border-slate-200 p-5 md:p-8 rounded-3xl shadow-sm text-center space-y-6 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* 🏷️ Лінії прогресу */}
        <div className="w-full flex gap-3" aria-hidden="true">
          <div className="h-2 flex-1 bg-emerald-700 rounded-full transition-all" />
          <div className="h-2 flex-1 bg-slate-100 rounded-full transition-all" />
        </div>

        {/* Заголовки */}
        <div className="space-y-2">
          <span className="inline-block text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3 py-1 rounded-md">
            Крок 1. Ваша роль
          </span>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Хто буде використовувати ШІ?
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-tight">
            Оберіть свій профіль, щоб асистент підлаштував правильний тон
            спілкування та документи.
          </p>
        </div>

        {/* Поле вибору ролі */}
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem className="space-y-3 w-full">
              <FormLabel className="sr-only">Оберіть роль</FormLabel>

              <FormControl>
                {/* 📱 Адаптивна сітка ролей: grid-cols-1 на телефонах, sm:grid-cols-2 на великих екранах */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full"
                  role="radiogroup"
                >
                  {/* 🏫 Варіант: Педагог */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      form.setValue("role", "teacher", { shouldValidate: true })
                    }
                    aria-checked={field.value === "teacher"}
                    role="radio"
                    className="p-0 h-auto bg-transparent hover:bg-transparent block text-left focus-visible:ring-4 focus-visible:ring-emerald-700/20 rounded-2xl transition-all w-full"
                  >
                    {/* 🛠️ Висота h-auto підлаштовується автоматично під обсяг тексту */}
                    <Card
                      className={`border-2 rounded-2xl transition-all relative overflow-hidden h-auto w-full ${
                        field.value === "teacher"
                          ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/10"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <CardContent className="p-5 flex flex-col justify-between h-full whitespace-normal w-full pb-10 sm:pb-5">
                        <div className="space-y-1">
                          <span
                            className="text-2xl filter drop-shadow-sm block"
                            role="img"
                            aria-label="Емодзі вчительки"
                          >
                            👩‍🏫
                          </span>
                          <h3 className="font-black text-slate-900 text-sm mt-2 tracking-tight">
                            Я — Педагог / Асистент
                          </h3>
                          <p className="text-[10px] text-slate-400 font-medium leading-tight mt-1 normal-case">
                            Робота за стандартами МОН, економія часу на
                            генерації звітів та блоків для ІПР.
                          </p>
                        </div>

                        {field.value === "teacher" && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-md absolute bottom-3 right-4">
                            ✓ Обрано
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </Button>

                  {/* 🏡 Варіант: Родина */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      form.setValue("role", "parent", { shouldValidate: true })
                    }
                    aria-checked={field.value === "parent"}
                    role="radio"
                    className="p-0 h-auto bg-transparent hover:bg-transparent block text-left focus-visible:ring-4 focus-visible:ring-emerald-700/20 rounded-2xl transition-all w-full"
                  >
                    <Card
                      className={`border-2 rounded-2xl transition-all relative overflow-hidden h-auto w-full ${
                        field.value === "parent"
                          ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/10"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <CardContent className="p-5 flex flex-col justify-between h-full whitespace-normal w-full pb-10 sm:pb-5">
                        <div className="space-y-1">
                          <span
                            className="text-2xl filter drop-shadow-sm block"
                            role="img"
                            aria-label="Емодзі будинку"
                          >
                            🏡
                          </span>
                          <h3 className="font-black text-slate-900 text-sm mt-2 tracking-tight">
                            Я — з Родини (Батьки)
                          </h3>
                          <p className="text-[10px] text-slate-400 font-medium leading-tight mt-1 normal-case">
                            Домашній розбір тем без сліз та стресу у вигляді
                            казок, квестів та історій.
                          </p>
                        </div>

                        {field.value === "parent" && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-md absolute bottom-3 right-4">
                            ✓ Обрано
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </Button>
                </div>
              </FormControl>
              <FormMessage className="text-xs font-bold text-rose-600 text-left pt-1" />
            </FormItem>
          )}
        />

        {/* 🚀 Головна кнопка дії */}
        <div className="pt-2 w-full">
          <Button
            type="submit"
            className="w-full py-6 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm hover:shadow transition active:scale-[0.98]"
          >
            Продовжити
          </Button>
        </div>
      </form>
    </Form>
  );
}
