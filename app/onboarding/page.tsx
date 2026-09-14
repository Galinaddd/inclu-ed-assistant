"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClientConnection } from "../utils/supabase/client";

// Замініть рядки 7 та 8 на цей варіант:
import RoleForm from "./_components/RoleForm";
import ChildForm from "./_components/ChildForm";

// Замініть рядок 11 на цей варіант:
import { submitOnboardingAction } from "./actions";
interface ReferenceItem {
  code?: string;
  level_number?: number;
  title: string;
  description: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClientConnection();

  // Керування кроками/формами
  const [step, setStep] = useState<1 | 2>(1);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Списки довідників з бази даних Supabase
  const [diagnosesList, setDiagnosesList] = useState<ReferenceItem[]>([]);
  const [supportLevelsList, setSupportLevelsList] = useState<ReferenceItem[]>(
    [],
  );

  // Головний стейт даних користувача, який збирається з обох форм
  const [role, setRole] = useState<"teacher" | "parent" | null>(null);
  const [childProfile, setChildProfile] = useState<string | null>(null);
  const [supportLevel, setSupportLevel] = useState<number | null>(null);
  const [childAge, setChildAge] = useState<string>("");
  const [schoolClass, setSchoolClass] = useState<string>("1");

  useEffect(() => {
    const fetchReferences = async () => {
      try {
        // 🎯 Чистий реляційний Join через базу даних за один запит зі збереженням назв змінних!
        const { data: diagData, error: diagErr } = await supabase.from(
          "ref_diagnoses",
        ).select(`
    code, 
    title, 
    description,
    group_id,
    ref_diagnosis_groups (
      id,
      title,
      sort_order
    )
      
  `);
        // 🎯 ДОДАЙТЕ СЮДИ ЦЕЙ РЯДОК:
        console.log("=== РЕАЛЬНІ ДАНІ З БАЗИ ДАННИХ ===", diagData); // 🎯 Тепер
        // об'єкт ref_diagnosis_groups гарантовано прийде з бази даних!

        const { data: supportData, error: supportErr } = await supabase
          .from("ref_support_levels")
          .select("level_number, title, description");

        if (diagErr) console.error("Помилка діагнозів:", diagErr);
        if (supportErr) console.error("Помилка рівнів:", supportErr);

        if (diagData) setDiagnosesList(diagData);
        if (supportData) setSupportLevelsList(supportData);
      } catch (err) {
        console.error("Глобальна помилка завантаження довідників МОН:", err);
        setErrorMessage("Не вдалося завантажити системні довідники з бази.");
      } finally {
        setLoadingRefs(false);
      }
    };
    fetchReferences();
  }, [supabase]);

  // Функція, яка спрацьовує при успішному завершенні форми Кроку 1
  const handleRoleComplete = (chosenRole: "teacher" | "parent") => {
    setRole(chosenRole);
    setErrorMessage(null);
    setStep(2); // Переходимо до форми дитини
  };

  // Функція, яка спрацьовує при успішній відправці форми Кроку 2
  const handleChildComplete = async (childData: {
    childProfile: string;
    supportLevel: number;
    childAge: number | null;
    schoolClass: number;
  }) => {
    setSubmitLoading(true);
    setErrorMessage(null);

    try {
      // Отримуємо поточного користувача (мідлвара вже гарантує, що він авторизований)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Користувача не знайдено.");

      if (!role) {
        setStep(1);
        throw new Error("Втрачено роль користувача. Оберіть її заново.");
      }

      // Викликаємо Server Action (наш чистий ізольований бекенд)
      const response = await submitOnboardingAction({
        userId: user.id,
        role: role,
        childProfile: childData.childProfile,
        supportLevel: childData.supportLevel,
        childAge: childData.childAge,
        schoolClass: childData.schoolClass,
      });

      if (response.success) {
        // Успіх! Перенаправляємо в кабінет (деплой та мідлвара оновлять роути)
        // 🎯 Замість window.location.href використовуємо фірмовий роутер Next.js!
        router.push("/dashboard");
        router.refresh(); // Оновлюємо серверні дані, щоб дашборд одразу побачив нову дитину
      } else {
        setErrorMessage(response.error || "Сталася помилка при збереженні.");
        setSubmitLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Помилка з'єднання з сервером.");
      setSubmitLoading(false);
    }
  };

  return (
    <main
      className="min-h-[calc(100vh-88px)] bg-[#FAF9F6] font-sans text-slate-900 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden"
      aria-label="Сторінка налаштування інклюзивного кабінету"
    >
      <h1 className="sr-only">IncluEdAssistant.ai — Налаштування</h1>

      {/* Глобальний вивід помилок на рівні сторінки */}
      {errorMessage && (
        <div
          className="w-full max-w-xl mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold text-left animate-in fade-in"
          role="alert"
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* 🔄 Диригент форм: показуємо потрібну форму залежно від етапу */}
      {step === 1 && (
        <RoleForm onComplete={handleRoleComplete} initialRole={role} />
      )}

      {step === 2 && (
        <ChildForm
          role={role!}
          diagnosesList={diagnosesList}
          supportLevelsList={supportLevelsList}
          loadingRefs={loadingRefs}
          submitLoading={submitLoading}
          onBack={() => setStep(1)}
          onComplete={handleChildComplete}
          initialValues={{
            childProfile,
            supportLevel,
            childAge,
            schoolClass,
          }}
          onChangeValues={(vals) => {
            if (vals.childProfile !== undefined)
              setChildProfile(vals.childProfile);
            if (vals.supportLevel !== undefined)
              setSupportLevel(vals.supportLevel);
            if (vals.childAge !== undefined) setChildAge(vals.childAge);
            if (vals.schoolClass !== undefined)
              setSchoolClass(vals.schoolClass);
          }}
        />
      )}
    </main>
  );
}
