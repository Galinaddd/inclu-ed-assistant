"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientConnection } from "../utils/supabase/client";

import RoleForm from "./_components/RoleForm";
import ChildForm from "./_components/ChildForm";
import { submitOnboardingAction } from "./actions";

interface ReferenceItem {
  code?: string;
  id?: string; // Для програм
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
  const [programsList, setProgramsList] = useState<ReferenceItem[]>([]);

  // Головний стейт даних користувача, який збирається з обох форм
  const [role, setRole] = useState<"teacher" | "parent" | null>(null);
  const [childName, setChildName] = useState<string>(""); // 🌟 ДОДАЛИ: Стейт імені для синхронізації з ChildForm
  const [childProfile, setChildProfile] = useState<string | null>(null);
  const [supportLevel, setSupportLevel] = useState<number | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [childAge, setChildAge] = useState<string>("");
  const [schoolClass, setSchoolClass] = useState<string>("1");

  useEffect(() => {
    const fetchReferences = async () => {
      try {
        // 1. Завантаження діагнозів
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

        // 2. Завантаження рівнів підтримки
        const { data: supportData, error: supportErr } = await supabase
          .from("ref_support_levels")
          .select("level_number, title, description");

        // 3. Завантаження освітніх програм з бази
        const { data: programData, error: programErr } = await supabase
          .from("educational_programs")
          .select("id, program_name, description");

        if (diagErr) console.error("Помилка діагнозів:", diagErr);
        if (supportErr) console.error("Помилка рівнів:", supportErr);
        if (programErr) console.error("Помилка програм:", programErr);

        if (diagData) setDiagnosesList(diagData as any);
        if (supportData) setSupportLevelsList(supportData as any);

        // Мапимо назву програми в title, щоб ChildForm прийняла об'єкт без конфліктів типів
        if (programData) {
          const formattedPrograms = programData.map((p) => ({
            id: p.id,
            title: p.program_name,
            description: p.description,
          }));
          setProgramsList(formattedPrograms);
        }
      } catch (err) {
        console.error("Глобальна помилка завантаження довідників МОН:", err);
        setErrorMessage("Не вдалося завантажити системні довідники з бази.");
      } finally {
        setLoadingRefs(false);
      }
    };
    fetchReferences();
  }, [supabase]);

  // Функція Кроку 1
  const handleRoleComplete = (chosenRole: "teacher" | "parent") => {
    setRole(chosenRole);
    setErrorMessage(null);
    setStep(2);
  };
  // Функція Кроку 2 з правильною, строгою типізацією аргументу
  const handleChildComplete = async (childData: {
    childName: string; // 🌟 ДОДАЛИ СЮДИ строгий тип імені
    childProfile: string;
    supportLevel: number;
    childAge: number | null;
    schoolClass: number;
    programId: string | null;
  }) => {
    setSubmitLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Користувача не знайдено.");

      if (!role) {
        setStep(1);
        throw new Error("Втрачено роль користувача. Оберіть її заново.");
      }

      // Викликаємо Server Action
      const response = await submitOnboardingAction({
        userId: user.id,
        role: role,
        childName: childData.childName, // 🌟 Надійно передаємо введене ім'я дитини
        childProfile: childData.childProfile,
        supportLevel: childData.supportLevel,
        childAge: childData.childAge,
        schoolClass: childData.schoolClass,
        programId: childData.programId,
      });

      if (response.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setErrorMessage(response.error || "Сталася ошибка при збереженні.");
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

      {errorMessage && (
        <div
          className="w-full max-w-xl mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold text-left animate-in fade-in"
          role="alert"
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Диригент кроків форми */}
      {step === 1 && (
        <RoleForm onComplete={handleRoleComplete} initialRole={role} />
      )}

      {step === 2 && (
        <ChildForm
          role={role!}
          diagnosesList={diagnosesList}
          supportLevelsList={supportLevelsList}
          programsList={programsList}
          loadingRefs={loadingRefs}
          submitLoading={submitLoading}
          onBack={() => setStep(1)}
          onComplete={handleChildComplete}
          initialValues={{
            childProfile,
            supportLevel,
            childAge,
            schoolClass,
            programId,
          }}
          onChangeValues={(vals) => {
            if (vals.childName !== undefined) setChildName(vals.childName); // 🌟 Трекаємо зміну імені
            if (vals.childProfile !== undefined)
              setChildProfile(vals.childProfile);
            if (vals.supportLevel !== undefined)
              setSupportLevel(vals.supportLevel);
            if (vals.childAge !== undefined) setChildAge(vals.childAge);
            if (vals.schoolClass !== undefined)
              setSchoolClass(vals.schoolClass);
            if (vals.programId !== undefined) setProgramId(vals.programId);
          }}
        />
      )}
    </main>
  );
}
