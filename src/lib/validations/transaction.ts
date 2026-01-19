"use client";

import { z } from "zod";

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    description: z
      .string()
      .min(1, "Descrição é obrigatória")
      .min(3, "Descrição deve ter pelo menos 3 caracteres"),
    amount: z.string().optional().or(z.literal("")),
    date: z
      .string()
      .min(1, "Data é obrigatória")
      .refine((val) => {
        if (!val) return false;
        // Parse date parts to validate format
        const [year, month, day] = val.split("-").map(Number);
        const selectedDate = new Date(year, month - 1, day);
        // Just check if it's a valid date
        return !isNaN(selectedDate.getTime());
      }, "Data inválida"),
    dueDate: z.string().optional().or(z.literal("")),
    status: z.enum(["pending", "paid", "overdue"]).default("pending"),
    clientId: z.string().optional().or(z.literal("")),
    clientName: z.string().optional().or(z.literal("")),
    category: z.string().optional().or(z.literal("")),
    wallet: z.string().optional().or(z.literal("")),
    isInstallment: z.boolean().default(false),
    installmentCount: z.number().min(1).max(24).default(2),
    notes: z.string().optional().or(z.literal("")),
    // New fields for advanced payment mode
    paymentMode: z.enum(["total", "installmentValue"]).default("total"),
    installmentValue: z.string().optional().or(z.literal("")),
    firstInstallmentDate: z.string().optional().or(z.literal("")),
    installmentsWallet: z.string().optional().or(z.literal("")),
    downPaymentEnabled: z.boolean().default(false),
    downPaymentValue: z.string().optional().or(z.literal("")),
    downPaymentWallet: z.string().optional().or(z.literal("")),
    downPaymentDueDate: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      // dueDate é obrigatório apenas para receitas (income) no modo "total"
      // No modo "installmentValue", usa-se firstInstallmentDate
      if (data.type === "income" && data.paymentMode === "total") {
        if (!data.dueDate || data.dueDate.trim() === "") {
          return false;
        }
      }
      return true;
    },
    {
      message: "Vencimento é obrigatório para receitas",
      path: ["dueDate"],
    }
  )
  .refine(
    (data) => {
      // Cliente é obrigatório apenas para receitas (income)
      if (data.type === "income") {
        if (!data.clientId && !data.clientName) {
          return false;
        }
        if (data.clientName && data.clientName.trim() === "") {
          return false;
        }
      }
      return true;
    },
    {
      message: "Cliente é obrigatório para receitas",
      path: ["clientId"],
    }
  )
  .refine(
    (data) => {
      // Skip date validation if either date is missing or if in installmentValue mode
      if (!data.date || data.paymentMode === "installmentValue") return true;
      if (!data.dueDate) return true;
      
      // Parse date parts to avoid timezone issues
      const [yearD, monthD, dayD] = data.date.split("-").map(Number);
      const [yearDue, monthDue, dayDue] = data.dueDate.split("-").map(Number);
      const date = new Date(yearD, monthD - 1, dayD);
      const dueDate = new Date(yearDue, monthDue - 1, dayDue);
      date.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= date;
    },
    {
      message: "Vencimento não pode ser anterior à data do lançamento",
      path: ["dueDate"],
    }
  );

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
