import { z } from "zod";

/**
 * Leads (oportunidades antes da proposta) e atividades do CRM.
 *
 * Etapas fixas de propósito: o funil das PROPOSTAS já é personalizável; o de
 * leads é curto e igual para todo mundo, e personalizar os dois dobraria a
 * configuração sem ganho.
 */
export const LEAD_STAGES = ["novo", "contato", "qualificado", "convertido", "perdido"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  "indicacao",
  "instagram",
  "site",
  "whatsapp",
  "google",
  "arquiteto",
  "outro",
] as const;

export const ACTIVITY_TYPES = ["nota", "ligacao", "whatsapp", "visita", "reuniao", "tarefa"] as const;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const LeadInputSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do lead.").max(120),
    phone: optionalText(30),
    email: z
      .string()
      .trim()
      .max(160)
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido.")
      .transform((v) => (v ? v.toLowerCase() : undefined)),
    company: optionalText(120),
    source: z.enum(LEAD_SOURCES).default("outro"),
    stage: z.enum(LEAD_STAGES).default("novo"),
    estimatedValue: z.number().min(0).max(100_000_000).nullable().optional(),
    notes: optionalText(2000),
    nextAction: optionalText(200),
    nextActionAt: z
      .string()
      .regex(ISO_DAY, "Data inválida.")
      .nullable()
      .optional(),
    lostReason: optionalText(300),
  })
  .strict();

/** Atualização parcial: qualquer campo do cadastro, sem padrões. */
export const LeadUpdateSchema = LeadInputSchema.partial()
  .extend({
    source: z.enum(LEAD_SOURCES).optional(),
    stage: z.enum(LEAD_STAGES).optional(),
  })
  .strict();

export const ActivityInputSchema = z
  .object({
    leadId: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    type: z.enum(ACTIVITY_TYPES),
    title: z.string().trim().min(1, "Descreva a atividade.").max(500),
    dueAt: z.string().regex(ISO_DAY, "Data inválida.").nullable().optional(),
  })
  .strict()
  .refine((v) => Boolean(v.leadId || v.clientId), {
    message: "A atividade precisa de um lead ou de um contato.",
  });

export const ActivityUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    dueAt: z.string().regex(ISO_DAY).nullable().optional(),
    done: z.boolean().optional(),
  })
  .strict();

/** Lead em aberto: ainda pode virar venda (lembrete e funil). */
export function isLeadOpen(stage: unknown): boolean {
  return stage !== "convertido" && stage !== "perdido";
}
