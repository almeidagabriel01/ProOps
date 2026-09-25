import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_RECORDS,
  pushRecentRecord,
  readRecentRecords,
  type RecentRecord,
} from "../command-palette-recents";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const proposta = (id: string): RecentRecord => ({
  kind: "proposal",
  id,
  label: `Proposta ${id}`,
  path: `/proposals/${id}`,
});

describe("recentes da busca", () => {
  it("começa vazio e guarda o registro aberto", () => {
    const storage = memoryStorage();
    expect(readRecentRecords(storage, "u1")).toEqual([]);
    pushRecentRecord(storage, "u1", proposta("a"));
    expect(readRecentRecords(storage, "u1")).toEqual([proposta("a")]);
  });

  it("põe o mais recente no topo sem duplicar", () => {
    const storage = memoryStorage();
    pushRecentRecord(storage, "u1", proposta("a"));
    pushRecentRecord(storage, "u1", proposta("b"));
    pushRecentRecord(storage, "u1", proposta("a"));
    expect(readRecentRecords(storage, "u1").map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("guarda no máximo cinco", () => {
    const storage = memoryStorage();
    for (const id of ["1", "2", "3", "4", "5", "6", "7"]) {
      pushRecentRecord(storage, "u1", proposta(id));
    }
    expect(readRecentRecords(storage, "u1")).toHaveLength(MAX_RECENT_RECORDS);
    expect(readRecentRecords(storage, "u1")[0].id).toBe("7");
  });

  it("separa por usuário", () => {
    const storage = memoryStorage();
    pushRecentRecord(storage, "u1", proposta("a"));
    expect(readRecentRecords(storage, "u2")).toEqual([]);
  });

  it("tolera conteúdo corrompido, sem storage ou sem usuário", () => {
    const storage = memoryStorage({
      "proops:command-palette:recents:u1": "{quebrado",
    });
    expect(readRecentRecords(storage, "u1")).toEqual([]);
    expect(readRecentRecords(null, "u1")).toEqual([]);
    expect(readRecentRecords(storage, null)).toEqual([]);
  });

  it("não quebra quando gravar falha", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => pushRecentRecord(storage, "u1", proposta("a"))).not.toThrow();
  });
});
