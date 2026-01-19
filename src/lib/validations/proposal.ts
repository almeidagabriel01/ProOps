"use client";

import { z } from "zod";

// ============================================
// PROPOSAL VALIDATION SCHEMA
// ============================================

export const proposalSchema = z.object({
  title: z
    .string()
    .min(1, "Título é obrigatório")
    .min(3, "Título deve ter pelo menos 3 caracteres"),
  clientName: z
    .string()
    .min(1, "Cliente é obrigatório"),
  clientEmail: z
    .string()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  clientPhone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .min(10, "Telefone deve ter pelo menos 10 dígitos"),
  clientAddress: z
    .string()
    .optional()
    .or(z.literal("")),
  validUntil: z
    .string()
    .min(1, "Data de validade é obrigatória")
    .refine((val) => {
      if (!val) return false;
      // Parse date parts to avoid timezone issues
      const [year, month, day] = val.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate > today;
    }, "Validade deve ser maior que hoje"),
});

export type ProposalFormData = z.infer<typeof proposalSchema>;

// Partial schema for real-time field validation
export const proposalFieldSchemas = {
  title: proposalSchema.shape.title,
  clientName: proposalSchema.shape.clientName,
  clientEmail: proposalSchema.shape.clientEmail,
  clientPhone: proposalSchema.shape.clientPhone,
  clientAddress: proposalSchema.shape.clientAddress,
  validUntil: proposalSchema.shape.validUntil,
};

