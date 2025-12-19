"use client";

import { z } from "zod";

// ============================================
// TEAM MEMBER VALIDATION SCHEMA
// ============================================

export const teamMemberSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
  role: z
    .string()
    .min(1, "Papel é obrigatório"),
  password: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type TeamMemberFormData = z.infer<typeof teamMemberSchema>;

// Partial schema for real-time field validation
export const teamMemberFieldSchemas = {
  name: teamMemberSchema.shape.name,
  email: teamMemberSchema.shape.email,
  role: teamMemberSchema.shape.role,
  password: teamMemberSchema.shape.password,
};
