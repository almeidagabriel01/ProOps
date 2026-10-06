import { db } from "../../init";

/**
 * O contato está em alguma proposta da empresa? Usado para recusar a exclusão
 * (pela tela, pela API e pela Lia) e pela consulta `GET /v1/proposals/usage`.
 */
export async function isClientUsed(tenantId: string, clientId: string): Promise<boolean> {
  const snap = await db
    .collection("proposals")
    .where("tenantId", "==", tenantId)
    .where("clientId", "==", clientId)
    .limit(1)
    .get();
  return !snap.empty;
}
