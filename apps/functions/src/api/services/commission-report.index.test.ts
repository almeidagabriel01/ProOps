/**
 * A consulta do relatorio de comissoes precisa casar com um indice DECLARADO.
 *
 * Mesmo risco do guard de duplicatas de nota recebida: o Firestore so reclama
 * de indice faltando em tempo de EXECUCAO, com `FAILED_PRECONDITION`, e um
 * teste unitario comum nao pega porque o mock aceita qualquer cadeia. A falha
 * estrearia no primeiro clique de alguem no relatorio.
 *
 * O detalhe que erra sozinho: intervalo em `dueDate` sem `orderBy` explicito e
 * tratado como ASC pelo Firestore, e a maioria dos indices de `transactions`
 * neste projeto e DESC. Um caractere entre reusar e exigir um indice novo.
 */

import fs from "node:fs";
import path from "node:path";

interface Chamada {
  campo: string;
  op?: string;
  direcao?: string;
}

const chamadas: Chamada[] = [];

jest.mock("../../init", () => ({
  db: {
    collection: () => {
      const chain = {
        where(campo: string, op: string) {
          chamadas.push({ campo, op });
          return chain;
        },
        orderBy(campo: string, direcao: string) {
          chamadas.push({ campo, direcao });
          return chain;
        },
        limit() {
          return chain;
        },
        get: async () => ({ docs: [] }),
      };
      return chain;
    },
  },
}));

jest.mock("../../lib/finance-helpers", () => ({
  checkFinancialPermission: jest.fn(async () => ({
    tenantId: "t1",
    isSuperAdmin: false,
  })),
}));

jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: jest.fn(),
}));

import {
  getCommissionReport,
  resolveMonthRange,
} from "./commission-report.service";

interface IndexField {
  fieldPath: string;
  order?: string;
}

function carregarIndices(): Array<{
  collectionGroup: string;
  fields: IndexField[];
}> {
  const arquivo = path.resolve(
    __dirname,
    "..","..","..","..","..",
    "firebase",
    "firestore.indexes.json",
  );
  // `utf-8-sig` nao existe em Node; o arquivo tem BOM e `JSON.parse` engasga.
  const bruto = fs.readFileSync(arquivo, "utf8").replace(/^﻿/, "");
  return JSON.parse(bruto).indexes ?? [];
}

describe("consulta do relatorio de comissoes vs firestore.indexes.json", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  it("usa um indice que existe, inclusive na direcao", async () => {
    await getCommissionReport("u1", undefined, { month: "2026-10" });

    const campos: Array<{ fieldPath: string; order: string }> = [];
    for (const c of chamadas) {
      const existente = campos.find((x) => x.fieldPath === c.campo);
      if (existente) {
        if (c.direcao) {
          existente.order = c.direcao === "desc" ? "DESCENDING" : "ASCENDING";
        }
        continue;
      }
      campos.push({
        fieldPath: c.campo,
        order: (c.direcao ?? "asc") === "desc" ? "DESCENDING" : "ASCENDING",
      });
    }

    const ordenado = chamadas.find((c) => c.direcao);
    expect(ordenado).toBeDefined();

    const indices = carregarIndices().filter(
      (i) => i.collectionGroup === "transactions",
    );

    const casa = indices.some((indice) => {
      const declarados = indice.fields.filter((f) => f.fieldPath !== "__name__");
      if (declarados.length < campos.length) return false;
      return campos.every((campo, i) => {
        const decl = declarados[i];
        if (!decl || decl.fieldPath !== campo.fieldPath) return false;
        if (campo.fieldPath !== ordenado?.campo) return true;
        return decl.order === campo.order;
      });
    });

    if (!casa) {
      const pedido = campos.map((c) => `${c.fieldPath}:${c.order}`).join(", ");
      throw new Error(
        [
          `Nenhum indice de 'transactions' atende ${pedido}.`,
          "Ajuste a consulta (reusar indice existente e mais barato) ou",
          "declare o indice em firebase/firestore.indexes.json.",
        ].join(" "),
      );
    }
    expect(casa).toBe(true);
  });

  it("escopa por tenant e so por comissao", async () => {
    await getCommissionReport("u1", undefined, { month: "2026-10" });

    const iguais = chamadas.filter((c) => c.op === "==").map((c) => c.campo);
    expect(iguais).toContain("tenantId");
    expect(iguais).toContain("isCommission");
  });
});

describe("resolveMonthRange", () => {
  it("cobre o mes inteiro", () => {
    expect(resolveMonthRange("2026-10")).toEqual({
      month: "2026-10",
      start: "2026-10-01",
      end: "2026-10-31",
    });
  });

  it("acerta mes de 30 dias", () => {
    expect(resolveMonthRange("2026-11").end).toBe("2026-11-30");
  });

  // Fevereiro fechado no dia 28 num ano bissexto perderia a ultima parcela do
  // mes, silenciosamente.
  it("acerta fevereiro bissexto", () => {
    expect(resolveMonthRange("2028-02").end).toBe("2028-02-29");
    expect(resolveMonthRange("2027-02").end).toBe("2027-02-28");
  });

  it("dezembro nao vaza para o ano seguinte", () => {
    expect(resolveMonthRange("2026-12")).toEqual({
      month: "2026-12",
      start: "2026-12-01",
      end: "2026-12-31",
    });
  });

  it("entrada invalida cai no mes corrente em vez de quebrar", () => {
    const agora = new Date();
    const esperado = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    expect(resolveMonthRange("").month).toBe(esperado);
    expect(resolveMonthRange("outubro").month).toBe(esperado);
  });
});
