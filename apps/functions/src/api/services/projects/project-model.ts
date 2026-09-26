import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isValidCpfOrCnpj } from "../../../lib/br-document";

/**
 * Projeto de instalação (a "ordem de serviço" da obra): o que acontece depois
 * que a proposta é aprovada. Etapas com checklist e fotos, técnico
 * responsável, datas e o aceite do cliente na entrega, pelo link.
 *
 * As etapas moram DENTRO do documento do projeto: uma obra tem poucas etapas,
 * a tela sempre as lê juntas, e um documento só evita a leitura em lote.
 */

export const PROJECT_STATUSES = ["active", "completed", "canceled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STAGE_STATUSES = ["pending", "in_progress", "done"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const MAX_STAGES = 15;
export const MAX_CHECKLIST_ITEMS = 40;
export const MAX_PHOTOS_PER_STAGE = 30;

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string | null;
  doneBy?: string | null;
}

export interface StagePhoto {
  id: string;
  url: string;
  storagePath: string;
  caption: string | null;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName: string | null;
}

export interface ProjectStage {
  id: string;
  name: string;
  status: StageStatus;
  checklist: ChecklistItem[];
  photos: StagePhoto[];
  completedAt: string | null;
}

export interface DeliveryAcceptance {
  name: string;
  document: string;
  acceptedAt: string;
  ip: string | null;
  userAgent: string | null;
}

export interface ProjectDelivery {
  /** `sent`: link enviado ao cliente; `accepted`: o cliente aceitou a entrega. */
  status: "none" | "sent" | "accepted";
  sharedProjectId: string | null;
  acceptance: DeliveryAcceptance | null;
}

export interface StageTemplate {
  name: string;
  checklist: string[];
}

/**
 * O que acontece com o projeto quando a proposta é aprovada:
 * - `ask`: a tela pergunta se a venda tem instalação (padrão). Nem toda venda
 *   é obra: quem só vende produto não quer um projeto a cada aprovação.
 * - `always`: cria sozinho.
 * - `never`: só pelo botão na proposta.
 */
export const PROJECT_ON_APPROVAL = ["ask", "always", "never"] as const;
export type ProjectOnApproval = (typeof PROJECT_ON_APPROVAL)[number];

export interface ProjectSettings {
  onApproval: ProjectOnApproval;
  /** Etapas com que todo projeto novo nasce. Vazio = padrão do nicho. */
  stageTemplate: StageTemplate[];
}

/**
 * Roteiro padrão por nicho. A empresa ajusta em Configurações; enquanto não
 * ajustar, vale este. Não é regra de produto, é ponto de partida.
 */
export const DEFAULT_STAGE_TEMPLATES: Record<string, StageTemplate[]> = {
  automacao_residencial: [
    {
      name: "Infraestrutura",
      checklist: ["Conferir tubulação e caixas", "Passar cabeamento", "Montar o quadro/rack"],
    },
    {
      name: "Instalação",
      checklist: ["Instalar os equipamentos", "Ligar e identificar os circuitos"],
    },
    {
      name: "Configuração",
      checklist: ["Programar cenas e automações", "Configurar o aplicativo", "Testar ambiente por ambiente"],
    },
    {
      name: "Entrega",
      checklist: ["Treinar o cliente", "Limpar e organizar a obra", "Registrar fotos finais"],
    },
  ],
  cortinas: [
    {
      name: "Medição",
      checklist: ["Medir vãos e altura", "Confirmar tecidos e acionamento"],
    },
    { name: "Produção", checklist: ["Enviar pedido", "Conferir peças recebidas"] },
    {
      name: "Instalação",
      checklist: ["Fixar trilhos e suportes", "Instalar as cortinas", "Regular e testar o acionamento"],
    },
    { name: "Entrega", checklist: ["Orientar o cliente", "Registrar fotos finais"] },
  ],
};

export function defaultTemplateForNiche(niche: unknown): StageTemplate[] {
  return DEFAULT_STAGE_TEMPLATES[String(niche || "")] ?? DEFAULT_STAGE_TEMPLATES.automacao_residencial;
}

export function defaultProjectSettings(niche: unknown): ProjectSettings {
  return { onApproval: "ask", stageTemplate: defaultTemplateForNiche(niche) };
}

/** Configuração gravada por cima do padrão do nicho. */
export function resolveProjectSettings(
  stored: (Partial<ProjectSettings> & { autoCreateOnApproval?: unknown }) | undefined | null,
  niche: unknown,
): ProjectSettings {
  const base = defaultProjectSettings(niche);
  const onApproval: ProjectOnApproval = PROJECT_ON_APPROVAL.includes(stored?.onApproval as ProjectOnApproval)
    ? (stored?.onApproval as ProjectOnApproval)
    : // A primeira versão guardava um liga/desliga; desligado continua "nunca".
      stored?.autoCreateOnApproval === false
      ? "never"
      : base.onApproval;
  return {
    onApproval,
    stageTemplate:
      Array.isArray(stored?.stageTemplate) && stored.stageTemplate.length > 0
        ? stored.stageTemplate
        : base.stageTemplate,
  };
}

export function buildStagesFromTemplate(
  template: StageTemplate[],
  newId: () => string = randomUUID,
): ProjectStage[] {
  return template.slice(0, MAX_STAGES).map((stage) => ({
    id: newId(),
    name: stage.name,
    status: "pending" as const,
    checklist: stage.checklist.slice(0, MAX_CHECKLIST_ITEMS).map((text) => ({
      id: newId(),
      text,
      done: false,
      doneAt: null,
      doneBy: null,
    })),
    photos: [],
    completedAt: null,
  }));
}

/** Id determinístico do projeto de uma proposta: aprovar duas vezes não duplica. */
export function projectIdForProposal(proposalId: string): string {
  return `proposal_${proposalId}`;
}

export interface ProjectProgress {
  stagesDone: number;
  stagesTotal: number;
  checklistDone: number;
  checklistTotal: number;
  /** 0 a 100, pelas etapas concluídas. */
  percent: number;
}

export function computeProgress(stages: ProjectStage[]): ProjectProgress {
  const stagesDone = stages.filter((s) => s.status === "done").length;
  const items = stages.flatMap((s) => s.checklist);
  return {
    stagesDone,
    stagesTotal: stages.length,
    checklistDone: items.filter((i) => i.done).length,
    checklistTotal: items.length,
    percent: stages.length === 0 ? 0 : Math.round((stagesDone / stages.length) * 100),
  };
}

/**
 * Etapa concluída carrega a data; reaberta, perde. Marcar a etapa como
 * concluída NÃO marca o checklist sozinho: o checklist é o registro do que foi
 * feito, e preenchê-lo automaticamente apagaria essa informação.
 */
export function applyStageStatus(
  stage: ProjectStage,
  status: StageStatus,
  now: string,
): ProjectStage {
  return {
    ...stage,
    status,
    completedAt: status === "done" ? stage.completedAt ?? now : null,
  };
}

// ---------------------------------------------------------------------------
// Entrada da API
// ---------------------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const optionalDay = z.string().regex(ISO_DAY, "Data inválida.").nullable().optional();

export const StageTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à etapa.").max(80),
    checklist: z.array(z.string().trim().min(1).max(200)).max(MAX_CHECKLIST_ITEMS),
  })
  .strict();

export const ProjectSettingsSchema = z
  .object({
    onApproval: z.enum(PROJECT_ON_APPROVAL).optional(),
    stageTemplate: z.array(StageTemplateSchema).min(1, "Mantenha ao menos uma etapa.").max(MAX_STAGES).optional(),
  })
  .strict();

export const CreateProjectSchema = z
  .object({
    proposalId: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(2, "Dê um nome ao projeto.").max(160).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.proposalId || v.title), {
    message: "Informe a proposta ou o nome do projeto.",
  });

export const UpdateProjectSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    assigneeId: z.string().trim().min(1).nullable().optional(),
    startDate: optionalDay,
    dueDate: optionalDay,
    notes: z.string().trim().max(4000).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

export const UpdateStageSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    status: z.enum(STAGE_STATUSES).optional(),
  })
  .strict();

export const ChecklistItemSchema = z
  .object({ text: z.string().trim().min(1, "Descreva o item.").max(200) })
  .strict();

export const ChecklistToggleSchema = z.object({ done: z.boolean() }).strict();

export const PhotoUploadSchema = z
  .object({
    /** `data:image/webp;base64,...`, já reduzida no navegador. */
    dataUrl: z.string().min(1).max(1_000_000),
    caption: z.string().trim().max(200).optional(),
  })
  .strict();

export const DeliveryAcceptanceSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome completo.").max(120),
    document: z.string().trim().refine(isValidCpfOrCnpj, "CPF ou CNPJ inválido."),
    accepted: z.literal(true, { message: "É preciso confirmar a entrega." }),
  })
  .strict();

export const PHOTO_MAX_BYTES = 700 * 1024;
const PHOTO_MIME = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/;

/** Decodifica a foto enviada, recusando o que não for imagem pequena. */
export function decodePhotoDataUrl(
  dataUrl: string,
): { contentType: string; buffer: Buffer; extension: string } | null {
  const match = PHOTO_MIME.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > PHOTO_MAX_BYTES) return null;
  const contentType = match[1];
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  return { contentType, buffer, extension };
}
