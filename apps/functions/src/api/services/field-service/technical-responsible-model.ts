import { z } from "zod";

/**
 * Responsável técnico do PMOC: o engenheiro (ou técnico) que assina o plano,
 * com o registro no conselho e a ART (Anotação de Responsabilidade Técnica).
 * Sem ART válida o PMOC não vale na fiscalização, por isso a validade é
 * acompanhada e avisada (`checkDueDates`).
 *
 * Cadastrado em Configurações, só pelo dono e pelos administradores, e só no
 * nicho de climatização (o PMOC é exigência da Lei 13.589/2018 para
 * ar-condicionado). Arquivo puro; quem grava é o controller.
 */

export const TECHNICAL_RESPONSIBLES_COLLECTION = "technical_responsibles";

export const COUNCILS = ["CREA", "CFT", "CAU"] as const;
export type Council = (typeof COUNCILS)[number];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const TechnicalResponsibleSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome do responsável.").max(120),
    profession: z.string().trim().min(3, "Informe a profissão (ex.: engenheiro mecânico).").max(120),
    council: z.enum(COUNCILS),
    registryNumber: z.string().trim().min(2, "Informe o número do registro no conselho.").max(40),
    artNumber: z.string().trim().max(40).nullable().optional(),
    artValidUntil: z.string().regex(ISO_DAY, "Data inválida.").nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const UpdateTechnicalResponsibleSchema = TechnicalResponsibleSchema.partial().strict();

export type TechnicalResponsibleInput = z.infer<typeof TechnicalResponsibleSchema>;

/**
 * O PDF da ART, em base64. O corpo da API aceita até 1 MB, o que dá uns 700 KB
 * de arquivo: a ART emitida pelo conselho costuma ter entre 100 e 300 KB.
 */
export const ART_MAX_BYTES = 700 * 1024;

export const ArtUploadSchema = z
  .object({
    dataUrl: z.string().min(1).max(1_000_000),
    fileName: z.string().trim().min(1).max(160),
  })
  .strict();

const PDF_DATA_URL = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/;

export function decodeArtPdf(dataUrl: string): Buffer | null {
  const match = PDF_DATA_URL.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length === 0 || buffer.length > ART_MAX_BYTES) return null;
  // Assinatura de PDF: o tipo declarado não basta.
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  return buffer;
}

export function artFilePath(tenantId: string, responsibleId: string): string {
  return `tenants/${tenantId}/technical_responsibles/${responsibleId}/art.pdf`;
}

export type ArtStatus = "missing" | "valid" | "expiring" | "expired";

/** Em 30 dias ou menos, a ART está vencendo. */
export const ART_EXPIRING_DAYS = 30;

export function artStatus(artValidUntil: string | null | undefined, today: string): ArtStatus {
  if (!artValidUntil) return "missing";
  if (artValidUntil < today) return "expired";
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + ART_EXPIRING_DAYS);
  return artValidUntil <= limit.toISOString().slice(0, 10) ? "expiring" : "valid";
}
