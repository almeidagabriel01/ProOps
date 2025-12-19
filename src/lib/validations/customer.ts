"use client";

import { z } from "zod";

// ============================================
// CUSTOMER VALIDATION SCHEMA
// ============================================

export const customerSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
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
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// Partial schema for real-time field validation
export const customerFieldSchemas = {
  name: customerSchema.shape.name,
  email: customerSchema.shape.email,
  phone: customerSchema.shape.phone,
  address: customerSchema.shape.address,
  notes: customerSchema.shape.notes,
};
