"use client";

import { z } from "zod";
import { cpf, cnpj } from "cpf-cnpj-validator";

export const customerSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .string()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .min(1, "Telefone é obrigatório"),
  address: z
    .string()
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .optional()
    .or(z.literal("")),
  document: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const digits = val.replace(/\D/g, "");
        if (digits.length === 11) return cpf.isValid(digits);
        if (digits.length === 14) return cnpj.isValid(digits);
        return false;
      },
      { message: "CPF ou CNPJ inválido" },
    ),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

export const customerFieldSchemas = {
  name: customerSchema.shape.name,
  email: customerSchema.shape.email,
  phone: customerSchema.shape.phone,
  address: customerSchema.shape.address,
  notes: customerSchema.shape.notes,
  document: customerSchema.shape.document,
};
