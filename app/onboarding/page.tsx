"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../utils/supabase";

interface ReferenceItem {
  code?: string;
  level_number?: number;
  title: string;
  description: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [diagnosesList, setDiagnosesList] = useState<ReferenceItem[]>([]);
  const [supportLevelsList, setSupportLevelsList] = useState<ReferenceItem[]>(
    [],
  );

  const [role, setRole] = useState<"teacher" | "parent" | null>(null);
  const [childProfile, setChildProfile] = useState<string | null>(null);
  const [supportLevel, setSupportLevel] = useState<number | null>(null);
  const [childAge, setChildAge] = useState<string>("");

  useEffect(() => {
    const fetchReferences = async () => {
      try {
        const { data: diagData } = await supabase
          .from("ref_diagnoses")
          .select("*");
        const { data: supportData } = await supabase
          .from("ref_support_levels")
          .select("*")
          .order("level_number");
        if (diagData) setDiagnosesList(diagData);
        if (supportData) setSupportLevelsList(supportData);
      } catch (err) {
        console.error("Помилка бази:", err);
      } finally {
        setLoadingRefs(false);
      }
    };
    fetchReferences();
  }, [supabase]);

  const handleNextStep = async () => {
    if (step === 1) {
      if (!role) return alert("Будь ласка, оберіть вашу роль");
      setStep(2);
    } else {
      if (!childProfile) return alert("Будь ласка, оберіть особливість дитини");
      if (!supportLevel)
        return alert("Будь ласка, оберіть рівень підтримки МОН");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return router.push("/");

        await supabase
          .from("profiles")
          .update({ role })
          .eq("id", session.user.id);
        await supabase.from("children_profiles").insert({
          parent_id: session.user.id,
          child_profile: childProfile,
          support_level: supportLevel,
          child_age: childAge ? parseInt(childAge) : null,
        });
        router.push("/dashboard");
      } catch (err: any) {
        alert("Помилка збереження: " + err.message);
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-88px)] bg-[#FAF9F6] font-sans text-slate-900 flex flex-col justify-center items-center px-4 py-6 relative overflow-hidden">
      <div className="max-w-xl w-full bg-white border-2 border-slate-300/80 p-5 md:p-8 rounded-3xl shadow-xs relative z-10 text-center">
        <div className="w-full flex gap-2 mb-6">
          <div className="h-2 flex-1 bg-emerald-700 rounded-full" />
          <div
            className={`h-2 flex-1 rounded-full ${step === 2 ? "bg-emerald-700" : "bg-slate-200"}`}
          />
        </div>

        {step === 1 && (
          <div className="animate-in fade-in duration-200">
            <span className="text-xs font-black uppercase tracking-widest text-sky-700 bg-sky-100 px-3 py-1 rounded-md">
              Крок 1. Ваша роль
            </span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-3 mb-4">
              Хто буде використовувати ШІ?
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setRole("teacher")}
                className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between h-32 cursor-pointer ${role === "teacher" ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
              >
                <div>
                  <span className="text-xl">👩‍🏫</span>
                  <h3 className="font-black text-slate-900 text-xs mt-2">
                    Я — Педагог
                  </h3>
                </div>
                {role === "teacher" && (
                  <span className="text-[10px] font-bold text-emerald-700 self-end">
                    ✓ Обрано
                  </span>
                )}
              </button>
              <button
                onClick={() => setRole("parent")}
                className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between h-32 cursor-pointer ${role === "parent" ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
              >
                <div>
                  <span className="text-xl">🏡</span>
                  <h3 className="font-black text-slate-900 text-xs mt-2">
                    Я — з Родини
                  </h3>
                </div>
                {role === "parent" && (
                  <span className="text-[10px] font-bold text-emerald-700 self-end">
                    ✓ Обрано
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in duration-200 text-left w-full">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-3 py-1 rounded-md block w-fit mx-auto mb-3">
              Крок 2. Особливості
            </span>
            {loadingRefs ? (
              <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse">
                Завантаження довідників МОН з бази...
              </div>
            ) : (
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5 ml-1">
                    1. Категорія труднощів дитини:
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {diagnosesList.map((diag) => (
                      <button
                        key={diag.code}
                        type="button"
                        onClick={() => setChildProfile(diag.code || null)}
                        className={`p-3 rounded-xl border-2 text-left flex flex-col gap-0.5 w-full cursor-pointer ${childProfile === diag.code ? "border-emerald-600 bg-emerald-50/30" : "border-slate-200 bg-white"}`}
                      >
                        <h4 className="font-black text-slate-900 text-xs">
                          {diag.title}
                        </h4>
                        <p className="text-[10px] font-medium text-slate-400 leading-tight">
                          {diag.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5 ml-1">
                    2. Офіційний рівень підтримки:
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {supportLevelsList.map((lvl) => (
                      <button
                        key={lvl.level_number}
                        type="button"
                        onClick={() =>
                          setSupportLevel(lvl.level_number || null)
                        }
                        className={`p-3 rounded-xl border-2 text-left flex justify-between items-center w-full cursor-pointer ${supportLevel === lvl.level_number ? "border-emerald-600 bg-emerald-50/30" : "border-slate-200 bg-white"}`}
                      >
                        <div>
                          <h4 className="font-black text-slate-900 text-xs">
                            {lvl.title}
                          </h4>
                          <p className="text-[10px] font-medium text-slate-400">
                            {lvl.description}
                          </p>
                        </div>
                        {supportLevel === lvl.level_number && (
                          <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1 w-full">
                  <label className="text-[10px] font-black text-slate-500 ml-1">
                    3. Вік дитини або класу (необов'язково)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={18}
                    placeholder="Наприклад: 8 років"
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    className="h-9 w-full rounded-xl border-2 border-slate-200 bg-[#FAF9F6] px-3 text-xs font-medium text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 w-full mt-6">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 h-11 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Назад
            </button>
          )}
          <button
            type="button"
            onClick={handleNextStep}
            disabled={
              loadingRefs ||
              (step === 1 ? !role : !childProfile || !supportLevel)
            }
            className="flex-1 inline-flex justify-center items-center px-6 h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs border-b-4 border-emerald-900 active:border-b-0 cursor-pointer disabled:opacity-40"
          >
            {step === 1 ? "Продовжити" : "Завершити налаштування"}
          </button>
        </div>
      </div>
    </div>
  );
}
