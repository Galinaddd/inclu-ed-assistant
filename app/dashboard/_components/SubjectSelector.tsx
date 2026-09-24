"use client";

import React from "react";

interface SubjectData {
  id: string;
  subject_name: string;
  program_id: string;
  school_class: number;
}

interface SubjectSelectorProps {
  childName: string;
  subjects: SubjectData[];
  activeSubject: SubjectData | null;
  setActiveSubject: (subj: SubjectData | null) => void;
}

export default function SubjectSelector({
  childName,
  subjects,
  activeSubject,
  setActiveSubject,
}: SubjectSelectorProps) {
  if (subjects.length === 0) return null;

  return (
    <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-xs text-left w-full space-y-3 animate-in fade-in duration-200">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
        📚 Оберіть предмет для {childName}:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((subj) => {
          const isSubjActive = activeSubject?.id === subj.id;
          return (
            <button
              key={subj.id}
              onClick={() => setActiveSubject(subj)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer focus:outline-hidden active:scale-95 ${
                isSubjActive
                  ? "bg-amber-100/90 border-amber-400 text-slate-900 font-black shadow-3xs"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {subj.subject_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
