"use client";

import { z } from "zod";

// ============================================
// AUTHENTICATION VALIDATION SCHEMAS
// ============================================

// Login schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
  password: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Registration schema
export const registerSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
  password: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve ter pelo menos uma letra maiúscula")
    .regex(/[0-9]/, "Senha deve ter pelo menos um número"),
  confirmPassword: z
    .string()
    .min(1, "Confirmação de senha é obrigatória"),
  companyName: z
    .string()
    .min(1, "Nome da empresa é obrigatório")
    .min(2, "Nome da empresa deve ter pelo menos 2 caracteres"),
  niche: z
    .string()
    .min(1, "Nicho é obrigatório"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

// Field schemas for real-time validation
export const loginFieldSchemas = {
  email: loginSchema.shape.email,
  password: loginSchema.shape.password,
};

export const registerFieldSchemas = {
  name: z.string().min(1, "Nome é obrigatório").min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória").min(8, "Senha deve ter pelo menos 8 caracteres").regex(/[A-Z]/, "Senha deve ter pelo menos uma letra maiúscula").regex(/[0-9]/, "Senha deve ter pelo menos um número"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
  companyName: z.string().min(1, "Nome da empresa é obrigatório").min(2, "Nome da empresa deve ter pelo menos 2 caracteres"),
  niche: z.string().min(1, "Nicho é obrigatório"),
};
