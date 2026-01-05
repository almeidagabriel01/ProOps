"use client";

import { z } from "zod";

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z
    .string()
    .min(1, "Descrição é obrigatória")
    .min(3, "Descrição deve ter pelo menos 3 caracteres"),
  amount: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, "Valor deve ser maior que 0"),
  date: z
    .string()
    .min(1, "Data é obrigatória")
    .refine((val) => {
      if (!val) return false;
      // Parse date parts to validate format
      const [year, month, day] = val.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);
      // Just check if it's a valid date
      return !isNaN(selectedDate.getTime());
    }, "Data inválida"),
  dueDate: z
    .string()
    .optional()
    .or(z.literal("")),
  status: z
    .enum(["pending", "paid", "overdue"])
    .default("pending"),
  clientId: z
    .string()
    .min(1, "Cliente é obrigatório"),
  clientName: z
    .string()
    .min(1, "Cliente é obrigatório"),
  category: z
    .string()
    .optional()
    .or(z.literal("")),
  wallet: z
    .string()
    .optional()
    .or(z.literal("")),
  isInstallment: z
    .boolean()
    .default(false),
  installmentCount: z
    .number()
    .min(2)
    .max(24)
    .default(2),
  notes: z
    .string()
    .optional()
    .or(z.literal("")),
}).refine((data) => {
  // dueDate é obrigatório apenas para receitas (income)
  if (data.type === "income" && (!data.dueDate || data.dueDate.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Vencimento é obrigatório para receitas",
  path: ["dueDate"],
}).refine((data) => {
  if (!data.date || !data.dueDate) return true;
  // Parse date parts to avoid timezone issues
  const [yearD, monthD, dayD] = data.date.split('-').map(Number);
  const [yearDue, monthDue, dayDue] = data.dueDate.split('-').map(Number);
  const date = new Date(yearD, monthD - 1, dayD);
  const dueDate = new Date(yearDue, monthDue - 1, dayDue);
  date.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate >= date;
}, {
  message: "Vencimento não pode ser anterior à data do lançamento",
  path: ["dueDate"],
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

// Partial schema for real-time field validation
export const transactionFieldSchemas = {
  description: transactionSchema.shape.description,
  amount: transactionSchema.shape.amount,
  date: transactionSchema.shape.date,
  dueDate: transactionSchema.shape.dueDate,
  category: transactionSchema.shape.category,
  wallet: transactionSchema.shape.wallet,
  notes: transactionSchema.shape.notes,
};
