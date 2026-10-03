import { db } from "../../init";

/** Teto de pessoas listadas; uma empresa real fica muito abaixo disso. */
const PEOPLE_LIMIT = 200;

export interface TeamPerson {
  id: string;
  name: string;
}

/**
 * Todas as pessoas da empresa (dono, administradores e membros), menos o
 * superadmin. É a lista de quem pode ser responsável por um cliente ou
 * por uma venda.
 */
export async function loadTeamPeople(tenantId: string): Promise<TeamPerson[]> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).limit(PEOPLE_LIMIT).get();
  return snap.docs
    .filter((doc) => String(doc.data().role || "").toUpperCase() !== "SUPERADMIN")
    .map((doc) => ({ id: doc.id, name: String(doc.data().name || doc.data().email || "Sem nome") }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Confere que o uid é de alguém da empresa e devolve o nome, para gravar
 * junto do id (o contato mostra o responsável sem ler `users`, que o membro
 * não pode ler).
 */
export async function resolveTeamPerson(tenantId: string, uid: string): Promise<TeamPerson | null> {
  const snap = await db.collection("users").doc(uid).get();
  const data = snap.data();
  if (!snap.exists || data?.tenantId !== tenantId) return null;
  if (String(data?.role || "").toUpperCase() === "SUPERADMIN") return null;
  return { id: snap.id, name: String(data?.name || data?.email || "Sem nome") };
}
