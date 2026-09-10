import { Request, Response } from "express";
import { z } from "zod";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import {
  MAX_NUMBERING_DIGITS,
  MAX_PRACAS,
  MAX_PRACA_LENGTH,
  MIN_NUMBERING_DIGITS,
} from "./proposal-numbering";
import {
  readNumberingConfig,
  saveNumberingConfig,
} from "../services/proposal-numbering.service";

/**
 * O corpo e validado aqui mesmo, alem de passar pelo saneamento do modulo puro:
 * o saneador prende valores na faixa, e isto recusa a chamada malformada antes
 * disso. Sem os dois, um `nextNumber` gigante vira um codigo absurdo em vez de
 * um 400.
 */
const NumberingConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    digits: z
      .number()
      .int()
      .min(MIN_NUMBERING_DIGITS)
      .max(MAX_NUMBERING_DIGITS)
      .optional(),
    resetYearly: z.boolean().optional(),
    pracas: z.array(z.string().max(MAX_PRACA_LENGTH * 2)).max(MAX_PRACAS).optional(),
    defaultPraca: z.string().max(MAX_PRACA_LENGTH * 2).nullable().optional(),
    nextNumber: z.number().int().min(1).max(9_999_999).optional(),
    year: z.number().int().min(1970).max(9999).optional(),
  })
  .strict();

/**
 * Leitura liberada para quem enxerga propostas: o formulario precisa da lista
 * de pracas para montar o seletor, e sem isso um membro nao conseguiria criar
 * proposta numa empresa que usa numeracao.
 */
export const getProposalNumbering = async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveUserAndTenant(req.user!.uid, req.user);
    const config = await readNumberingConfig(tenantId);
    return res.json(config);
  } catch (error: unknown) {
    console.error("getProposalNumbering Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao ler a numeração.";
    return res.status(500).json({ message });
  }
};

/**
 * Escrita so do master: a numeracao e o identificador dos documentos da
 * empresa, e mexer no contador altera o codigo de tudo o que vier depois.
 */
export const updateProposalNumbering = async (req: Request, res: Response) => {
  try {
    const parsed = NumberingConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
      return res.status(400).json({ message: firstError });
    }

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(
      req.user!.uid,
      req.user,
    );

    if (!isMaster && !isSuperAdmin) {
      return res.status(403).json({
        message: "Apenas administradores podem alterar a numeração.",
      });
    }

    const config = await saveNumberingConfig(tenantId, parsed.data);
    // Responde EXATAMENTE o que o GET responde, sem envelope nem flag de
    // sucesso. A tela guarda a resposta no estado e a reenvia no salvamento
    // seguinte; um `success: true` a mais voltava como chave desconhecida e o
    // `.strict()` recusava com 400. O primeiro salvamento passava e o segundo
    // quebrava, que e a forma mais cara de descobrir isso.
    return res.json(config);
  } catch (error: unknown) {
    console.error("updateProposalNumbering Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao salvar a numeração.";
    return res.status(500).json({ message });
  }
};
