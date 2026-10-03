import { db } from "../../init";

/** Tipos de contato que recebem comissão e por isso podem ser ligados a um membro. */
const COMMISSION_PARTNER_TYPES = ["vendedor", "arquiteto"];

/**
 * Contato parceiro de comissão (vendedor ou arquiteto) ligado a um membro da
 * equipe (`linkedMemberId`).
 *
 * O parceiro interno existe duas vezes: como membro (entra na meta, é o
 * "responsável pela venda", vê "Minhas comissões") e como contato (recebe
 * comissão). Para o vendedor, a ligação também faz a comissão dele entrar
 * sozinha na proposta quando ele é o responsável. Um membro liga a um contato
 * só: com dois, a proposta não saberia qual comissão sugerir.
 *
 * `types` são os tipos com que o contato fica gravado: cliente ou fornecedor
 * não recebem comissão, e não há o que ligar.
 */
export async function validateMemberLink(
  tenantId: string,
  memberId: string,
  currentClientId?: string,
  types?: readonly string[],
): Promise<void> {
  if (types && !types.some((type) => COMMISSION_PARTNER_TYPES.includes(type))) {
    throw new Error("CONTATO_NAO_PARCEIRO");
  }
  const user = await db.collection("users").doc(memberId).get();
  if (!user.exists || user.data()?.tenantId !== tenantId) {
    throw new Error("MEMBRO_INVALIDO");
  }
  const linked = await db
    .collection("clients")
    .where("tenantId", "==", tenantId)
    .where("linkedMemberId", "==", memberId)
    .limit(2)
    .get();
  const other = linked.docs.find((doc) => doc.id !== currentClientId);
  if (other) {
    throw new Error(`MEMBRO_JA_LIGADO:${String(other.data().name ?? "outro contato")}`);
  }
}

/** Mensagem para a tela a partir do erro de `validateMemberLink`. */
export function memberLinkErrorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  if (message === "MEMBRO_INVALIDO") return "Esse membro não é da sua empresa.";
  if (message === "CONTATO_NAO_PARCEIRO") {
    return "Só vendedor ou arquiteto pode ser ligado a um membro da equipe.";
  }
  if (message.startsWith("MEMBRO_JA_LIGADO:")) {
    return `Esse membro já está ligado ao contato "${message.slice("MEMBRO_JA_LIGADO:".length)}".`;
  }
  return null;
}
