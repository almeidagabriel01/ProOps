"use client";

import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

/**
 * A leitura de quem tem "só os meus" numa coleção (`lib/permissions/query-scope.ts`):
 * empresa e dono, só igualdade, sem índice composto. Cada service aplica na
 * memória o resto do que a consulta original pedia (status, período, ordem,
 * página). O teto protege a tela; uma pessoa com mais registros que isso é
 * rara e vê os primeiros.
 */
export const OWN_SCOPE_MAX = 1000;

export async function fetchOwnDocs(
  collectionName: string,
  tenantId: string,
  owner: { field: string; uid: string },
  max = OWN_SCOPE_MAX,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const snap = await getDocs(
    query(
      collection(db, collectionName),
      where("tenantId", "==", tenantId),
      where(owner.field, "==", owner.uid),
      limit(max),
    ),
  );
  return snap.docs;
}

/** Valor comparável de um campo de data gravado como Timestamp, ISO ou dia. */
export function comparableValue(value: unknown): string | number {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Ordena como o `orderBy` do Firestore faria, pelo campo cru do documento. */
export function sortSnapshots(
  docs: QueryDocumentSnapshot<DocumentData>[],
  field: string,
  direction: "asc" | "desc",
): QueryDocumentSnapshot<DocumentData>[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...docs].sort((a, b) => {
    const x = comparableValue(a.data()[field]);
    const y = comparableValue(b.data()[field]);
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), "pt-BR", { sensitivity: "base", numeric: true }) * sign;
  });
}

/** A página depois do cursor (o último documento da página anterior). */
export function pageAfter<T>(
  docs: QueryDocumentSnapshot<DocumentData>[],
  cursor: QueryDocumentSnapshot<DocumentData> | null | undefined,
  pageSize: number,
  map: (doc: QueryDocumentSnapshot<DocumentData>) => T,
): { data: T[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean } {
  const start = cursor ? docs.findIndex((doc) => doc.id === cursor.id) + 1 : 0;
  const page = docs.slice(start, start + pageSize);
  return {
    data: page.map(map),
    lastDoc: page.length > 0 ? page[page.length - 1] : null,
    hasMore: start + pageSize < docs.length,
  };
}
