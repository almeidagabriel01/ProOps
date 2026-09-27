/**
 * Registros abertos pela busca (Ctrl+K), para aparecerem ao focar o campo
 * vazio. Conveniência por navegador: fica no localStorage, por usuário, e a
 * leitura tolera armazenamento bloqueado ou corrompido devolvendo lista vazia.
 */

export type RecentRecordKind = "proposal" | "contact";

export interface RecentRecord {
  kind: RecentRecordKind;
  id: string;
  label: string;
  description?: string;
  path: string;
}

export const MAX_RECENT_RECORDS = 5;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storageKey(userId: string): string {
  return `proops:command-palette:recents:${userId}`;
}

function isRecentRecord(value: unknown): value is RecentRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.kind === "proposal" || record.kind === "contact") &&
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.path === "string"
  );
}

export function readRecentRecords(
  storage: StorageLike | null | undefined,
  userId: string | null | undefined,
): RecentRecord[] {
  if (!storage || !userId) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey(userId)) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(isRecentRecord).slice(0, MAX_RECENT_RECORDS)
      : [];
  } catch {
    return [];
  }
}

/** Põe o registro no topo, sem duplicar, e corta no máximo. */
export function pushRecentRecord(
  storage: StorageLike | null | undefined,
  userId: string | null | undefined,
  record: RecentRecord,
): RecentRecord[] {
  const next = [
    record,
    ...readRecentRecords(storage, userId).filter(
      (r) => !(r.kind === record.kind && r.id === record.id),
    ),
  ].slice(0, MAX_RECENT_RECORDS);
  if (storage && userId) {
    try {
      storage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      // Armazenamento cheio ou bloqueado: a busca continua funcionando sem recentes.
    }
  }
  return next;
}
