"use client";

import { z } from "zod";

// ============================================
// PRODUCT VALIDATION SCHEMA
// ============================================

export const productSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional().or(z.literal("")),
  price: z
    .string()
    .min(1, "Preço é obrigatório")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, "Preço deve ser maior que 0"),
  markup: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val === "") return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 1000;
    }, "Markup deve ser um percentual entre 0 e 1000"),
  manufacturer: z.string().min(1, "Fabricante é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  inventoryValue: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val === "") return true;
      const num = Number.parseFloat(val.replace(",", "."));
      return !isNaN(num) && num >= 0;
    }, "Estoque deve ser um número não negativo"),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const serviceSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional().or(z.literal("")),
  price: z
    .string()
    .min(1, "Preço é obrigatório")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, "Preço deve ser maior que 0"),
  category: z.string().min(1, "Categoria é obrigatória"),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type ProductFormData = z.infer<typeof productSchema>;
export type ServiceFormData = z.infer<typeof serviceSchema>;

// Partial schema for real-time field validation
export const productFieldSchemas = {
  name: productSchema.shape.name,
  description: productSchema.shape.description,
  price: productSchema.shape.price,
  markup: productSchema.shape.markup,
  manufacturer: productSchema.shape.manufacturer,
  category: productSchema.shape.category,
  inventoryValue: productSchema.shape.inventoryValue,
  status: productSchema.shape.status,
};
