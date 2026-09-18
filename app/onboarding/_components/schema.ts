import * as z from "zod";

export const roleFormSchema = z.object({
  role: z.string().min(1, "Будь ласка, оберіть вашу роль."),
});
export type RoleFormValues = z.infer<typeof roleFormSchema>;

export const childFormSchema = z.object({
  // Нове обов'язкове поле для імені учня / дитини
  childName: z.string().min(2, "Введіть ім'я дитини (мінімум 2 символи)."),

  // Автоматично перетворюємо рядок віку в число для бази
  childAge: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((age) => !isNaN(age) && age >= 5 && age <= 18, {
      message: "Вік має бути від 5 до 18 років.",
    }),

  // Автоматично перетворюємо рядок класу в число для бази
  schoolClass: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((cls) => !isNaN(cls) && cls >= 1 && cls <= 11, {
      message: "Клас має бути від 1 до 11.",
    }),

  childProfile: z
    .string()
    .min(1, "Будь ласка, оберіть категорію труднощів дитини."),

  // Перетворюємо рівень підтримки з селектора в число, щоб не було помилки "received string"
  supportLevel: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(5)),

  // Було: programId: z.string().nullable().optional(),

  // Стало: поле обов'язкове, з чітким текстом помилки
  programId: z.string().min(1, "Будь ласка, оберіть освітню програму учня."),
});

export type ChildFormValues = z.infer<typeof childFormSchema>;
