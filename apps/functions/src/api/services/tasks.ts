import { z } from "zod";

/**
 * Tarefas: o "a fazer, com responsável" da equipe, ligado ou não a um contato,
 * uma proposta ou um lead.
 *
 * Coleção própria (`tasks`) e não as atividades do CRM porque a visibilidade é
 * outra: a tarefa é da pessoa (quem criou, o responsável e quem foi citado; o
 * dono vê todas), enquanto o histórico do lead é da equipe. Numa coleção só,
 * as rules não conseguiriam liberar uma lista que mistura os dois, e a tela do
 * lead seria recusada. O tipo "Tarefa" das atividades foi aposentado na tela
 * pelo mesmo motivo: um conceito de tarefa, não dois.
 *
 * `audienceUids` é o que as rules leem: criador, responsável e mencionados.
 */

export const TASKS_COLLECTION = "tasks";
export const MAX_MENTIONS = 20;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const optionalId = z.string().trim().min(1).max(128).optional();

export const CreateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Descreva a tarefa.").max(200),
    notes: z.string().trim().max(2000).optional(),
    dueAt: z.string().regex(ISO_DAY, "Data inválida.").nullable().optional(),
    assigneeId: z.string().trim().min(1).max(128).nullable().optional(),
    mentionUids: z.array(z.string().trim().min(1).max(128)).max(MAX_MENTIONS).optional(),
    clientId: optionalId,
    proposalId: optionalId,
    leadId: optionalId,
  })
  .strict();

export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Descreva a tarefa.").max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
    dueAt: z.string().regex(ISO_DAY, "Data inválida.").nullable().optional(),
    assigneeId: z.string().trim().min(1).max(128).nullable().optional(),
    mentionUids: z.array(z.string().trim().min(1).max(128)).max(MAX_MENTIONS).optional(),
    done: z.boolean().optional(),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

/** Quem enxerga a tarefa, sem repetição e sem vazio. */
export function buildAudience(
  createdBy: string,
  assigneeId: string | null | undefined,
  mentionUids: string[] | undefined,
): string[] {
  return Array.from(
    new Set([createdBy, assigneeId, ...(mentionUids ?? [])].filter((v): v is string => Boolean(v))),
  );
}

/**
 * Quem deve ser avisado numa criação ou edição. Quem fez a ação nunca é
 * avisado da própria ação; o responsável novo é avisado pela atribuição (e não
 * também pela menção); menção só avisa quem ainda não estava citado.
 */
export function planTaskNotifications(input: {
  actorUid: string;
  previousAssigneeId: string | null;
  assigneeId: string | null;
  previousMentionUids: string[];
  mentionUids: string[];
}): { assigned: string | null; mentioned: string[] } {
  const assigned =
    input.assigneeId &&
    input.assigneeId !== input.previousAssigneeId &&
    input.assigneeId !== input.actorUid
      ? input.assigneeId
      : null;
  const before = new Set(input.previousMentionUids);
  const mentioned = Array.from(new Set(input.mentionUids)).filter(
    (uid) => !before.has(uid) && uid !== input.actorUid && uid !== assigned,
  );
  return { assigned, mentioned };
}

/** "25/09" para a mensagem da notificação. */
export function formatDueShort(dueAt: string | null | undefined): string | null {
  if (!dueAt || !ISO_DAY.test(dueAt)) return null;
  const [, month, day] = dueAt.split("-");
  return `${day}/${month}`;
}
