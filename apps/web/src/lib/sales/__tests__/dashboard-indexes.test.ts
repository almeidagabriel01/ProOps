import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * As consultas do Dashboard sobre propostas precisam de índice DECLARADO em
 * `firebase/firestore.indexes.json`. O emulador não cobra índice, então os
 * testes locais passam e a falha só aparece no projeto publicado, como
 * "The query requires an index". Foi o que aconteceu com a soma de "Em
 * negociação": agregação `sum` exige o campo somado no índice.
 */

interface IndexField {
  fieldPath: string;
  order?: string;
}

const raw = fs
  .readFileSync(path.resolve(__dirname, "../../../../../../firebase/firestore.indexes.json"), "utf8")
  .replace(/^﻿/, "");
const indexes = (JSON.parse(raw) as {
  indexes: Array<{ collectionGroup: string; queryScope: string; fields: IndexField[] }>;
}).indexes;

/** Igualdades em qualquer ordem, depois o campo de intervalo/ordem/soma. */
function hasIndex(equalities: string[], last: string, order = "ASCENDING"): boolean {
  return indexes.some((idx) => {
    if (idx.collectionGroup !== "proposals" || idx.queryScope !== "COLLECTION") return false;
    const fields = idx.fields.filter((f) => f.fieldPath !== "__name__");
    if (fields.length !== equalities.length + 1) return false;
    const head = fields.slice(0, -1).map((f) => f.fieldPath).sort();
    const tail = fields[fields.length - 1];
    return (
      JSON.stringify(head) === JSON.stringify([...equalities].sort()) &&
      tail.fieldPath === last &&
      tail.order === order
    );
  });
}

describe("índices das consultas do Dashboard", () => {
  it("vendas do mês: aprovadas por approvedAt", () => {
    expect(hasIndex(["tenantId"], "approvedAt")).toBe(true);
  });

  it("em negociação: soma de totalValue por status", () => {
    expect(hasIndex(["tenantId", "status"], "totalValue")).toBe(true);
  });

  it("vencendo: validade por status", () => {
    expect(hasIndex(["tenantId", "status"], "validUntil")).toBe(true);
  });

  it("paradas: updatedAt por status", () => {
    expect(hasIndex(["tenantId", "status"], "updatedAt")).toBe(true);
  });
});
