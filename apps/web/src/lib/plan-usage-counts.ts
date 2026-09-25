import {
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type PlanUsageCollection = "proposals" | "clients" | "products";

/**
 * Conta os documentos do tenant por aggregation `count()`: o servidor devolve
 * só o número, cobrado a 1 leitura por 1.000 entradas do índice. Antes a
 * contagem baixava a coleção inteira (`getDocs(...).size`) a cada criação de
 * produto, proposta ou contato em plano com limite, e o custo crescia com o
 * histórico do cliente.
 */
export async function countTenantDocs(
  collectionName: PlanUsageCollection,
  tenantId: string,
): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, collectionName), where("tenantId", "==", tenantId)),
  );
  return snap.data().count;
}

export async function countTenantMembers(tenantId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(
      collection(db, "users"),
      where("tenantId", "==", tenantId),
      where("role", "==", "MEMBER"),
    ),
  );
  return snap.data().count;
}
