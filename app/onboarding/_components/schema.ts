import * as z from "zod";

// Схема для першої форми (Вибір ролі)
export const roleFormSchema = z.object({
  role: z.string().min(1, "Будь ласка, оберіть вашу роль."),
});
export type RoleFormValues = z.infer<typeof roleFormSchema>;

// Схема для другої форми (Картка дитини)
export const childFormSchema = z.object({
  childAge: z.string().refine(
    (val) => {
      const age = parseInt(val, 10);
      return !isNaN(age) && age >= 5 && age <= 18;
    },
    { message: "Вік має бути від 5 до 18 років." },
  ),

  schoolClass: z.string().refine(
    (val) => {
      const cls = parseInt(val, 10);
      return !isNaN(cls) && cls >= 1 && cls <= 11;
    },
    { message: "Клас має бути від 1 до 11." },
  ),

  childProfile: z
    .string()
    .min(1, "Будь ласка, оберіть категорію труднощів дитини."),

  supportLevel: z.number().min(1).max(5).optional(),
});
export type ChildFormValues = z.infer<typeof childFormSchema>;
