"use client";

import { z } from "zod";
import { ProductPricingMode } from "@/lib/product-pricing";

const productPricingModeSchema = z
  .enum(
    ["standard", "curtain_meter", "curtain_height", "curtain_width"] satisfies [
      ProductPricingMode,
      ...ProductPricingMode[],
    ],
  )
  .default("standard");

const heightTierSchema = z.object({
  id: z.string().min(1, "Faixa inválida"),
  maxHeight: z.string().min(1, "Altura máxima obrigatória"),
  basePrice: z.string().min(1, "Preço bruto obrigatório"),
  markup: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val === "") return true;
      const num = parseFloat(val);
      return !Number.isNaN(num) && num >= 0 && num <= 1000;
    }, "Markup deve ser um percentual entre 0 e 1000"),
});

// ============================================
// PRODUCT VALIDATION SCHEMA
// ============================================

export const productSchema = z
  .object({
    name: z
      .string()
      .min(1, "Nome é obrigatório")
      .min(2, "Nome deve ter pelo menos 2 caracteres"),
    description: z.string().optional().or(z.literal("")),
    price: z.string().optional().or(z.literal("")),
    markup: z
      .string()
      .optional()
      .refine((val) => {
        if (!val || val === "") return true;
        const num = parseFloat(val);
        return !Number.isNaN(num) && num >= 0 && num <= 1000;
      }, "Markup deve ser um percentual entre 0 e 1000"),
    pricingMode: productPricingModeSchema,
    heightPricingTiers: z.array(heightTierSchema).default([]),
    manufacturer: z.string().min(1, "Fabricante é obrigatório"),
    category: z.string().min(1, "Categoria é obrigatória"),
    inventoryValue: z
      .string()
      .optional()
      .refine((val) => {
        if (!val || val === "") return true;
        const num = Number.parseFloat(val.replace(",", "."));
        return !Number.isNaN(num) && num >= 0;
      }, "Estoque deve ser um número não negativo"),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .superRefine((value, ctx) => {
    if (value.pricingMode === "curtain_height") {
      if (value.heightPricingTiers.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["heightPricingTiers"],
          message: "Cadastre pelo menos uma faixa de altura",
        });
        return;
      }

      let previousMaxHeight = 0;
      value.heightPricingTiers.forEach((tier, index) => {
        const maxHeight = Number.parseFloat(tier.maxHeight.replace(",", "."));
        const basePrice = Number.parseFloat(tier.basePrice.replace(",", "."));
        const markup = tier.markup ? Number.parseFloat(tier.markup) : 0;

        if (!Number.isFinite(maxHeight) || maxHeight <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["heightPricingTiers", index, "maxHeight"],
            message: "Altura máxima deve ser maior que 0",
          });
        }

        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["heightPricingTiers", index, "basePrice"],
            message: "Preço bruto deve ser maior que 0",
          });
        }

        if (!Number.isFinite(markup) || markup < 0 || markup > 1000) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["heightPricingTiers", index, "markup"],
            message: "Markup deve ser um percentual entre 0 e 1000",
          });
        }

        if (Number.isFinite(maxHeight) && maxHeight <= previousMaxHeight) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["heightPricingTiers", index, "maxHeight"],
            message: "As alturas máximas devem estar em ordem crescente",
          });
        }

        previousMaxHeight = Number.isFinite(maxHeight)
          ? Math.max(previousMaxHeight, maxHeight)
          : previousMaxHeight;
      });

      return;
    }

    const price = Number.parseFloat((value.price || "").replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Preço deve ser maior que 0",
      });
    }
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
      return !Number.isNaN(num) && num > 0;
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
  pricingMode: productSchema.shape.pricingMode,
  heightPricingTiers: productSchema.shape.heightPricingTiers,
  manufacturer: productSchema.shape.manufacturer,
  category: productSchema.shape.category,
  inventoryValue: productSchema.shape.inventoryValue,
  status: productSchema.shape.status,
};
