import { db } from "../../init";

/**
 * Contato vendedor ligado a um membro da equipe (`linkedMemberId`).
 *
 * O vendedor interno existe duas vezes: como membro (entra na meta, é o
 * "responsável pela venda") e como contato do tipo vendedor (recebe comissão).
 * A ligação é o que faz a comissão dele entrar sozinha na proposta quando ele é
 * o responsável. Um membro liga a um contato só: com dois, a proposta não
 * saberia qual comissão sugerir.
 */
export async function validateMemberLink(
  tenantId: string,
  memberId: string,
  currentClientId?: string,
): Promise<void> {
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
  if (message.startsWith("MEMBRO_JA_LIGADO:")) {
    return `Esse membro já está ligado ao contato "${message.slice("MEMBRO_JA_LIGADO:".length)}".`;
  }
  return null;
}
