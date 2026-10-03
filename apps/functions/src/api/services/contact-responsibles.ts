import { db } from "../../init";
import { resolveTeamPerson, type TeamPerson } from "./team-people";

/**
 * Quem cuida do cliente: um responsável da equipe (`responsibleMemberId`,
 * gravado com o nome) e parceiros externos (`partnerContactIds`, contatos
 * vendedor ou arquiteto). A proposta herda os dois ao escolher o cliente.
 *
 * O id vem do navegador, então é conferido aqui: a pessoa tem que ser da
 * empresa, e cada parceiro tem que ser um contato da empresa com papel de
 * vendedor ou arquiteto.
 */

export const MAX_PARTNER_CONTACTS = 10;
const PARTNER_TYPES = ["vendedor", "arquiteto"];

export async function resolveResponsibleMember(
  tenantId: string,
  uid: string,
): Promise<TeamPerson> {
  const person = await resolveTeamPerson(tenantId, uid);
  if (!person) throw new Error("RESPONSAVEL_INVALIDO");
  return person;
}

/** Ids únicos, sem o próprio contato, todos parceiros da empresa. */
export async function resolvePartnerContactIds(
  tenantId: string,
  ids: readonly string[],
  selfId?: string,
): Promise<string[]> {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).filter(
    (id) => id !== selfId,
  );
  if (unique.length === 0) return [];
  if (unique.length > MAX_PARTNER_CONTACTS) throw new Error("PARCEIRO_INVALIDO");

  const snaps = await db.getAll(...unique.map((id) => db.collection("clients").doc(id)));
  for (const snap of snaps) {
    const data = snap.data();
    const types = Array.isArray(data?.types) ? (data?.types as string[]) : [];
    if (!snap.exists || data?.tenantId !== tenantId || !types.some((t) => PARTNER_TYPES.includes(t))) {
      throw new Error("PARCEIRO_INVALIDO");
    }
  }
  return unique;
}

/** Mensagem para a tela a partir dos erros acima. */
export function contactResponsiblesErrorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  if (message === "RESPONSAVEL_INVALIDO") return "O responsável escolhido não é da sua empresa.";
  if (message === "PARCEIRO_INVALIDO") {
    return "Parceiro inválido: escolha vendedores ou arquitetos cadastrados nos seus contatos.";
  }
  return null;
}
