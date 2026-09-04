/**
 * A consulta de duplicatas precisa casar com um índice DECLARADO.
 *
 * Firestore só reclama de índice faltando **em tempo de execução**, com
 * `FAILED_PRECONDITION`. Um teste unitário comum não pega: o mock aceita
 * qualquer cadeia. Então a falha estreia no clique de alguém — e neste caso
 * seria no primeiro "Lançar" de um cliente em produção.
 *
 * O caso real: a consulta usava intervalo em `date` **sem `orderBy`**, o que o
 * Firestore trata como ASC, enquanto o índice do projeto é
 * `(tenantId, type, date DESC)`. Um caractere de diferença entre reusar um
 * índice existente e exigir um novo.
 *
 * Este teste grava a cadeia que o serviço monta e confere contra
 * `firestore.indexes.json` — a mesma fonte que o deploy publica.
 */

import fs from "node:fs";
import path from "node:path";

interface Chamada {
  campo: string;
  op?: string;
  direcao?: string;
}

const chamadas: Chamada[] = [];
const getReceivedInvoice = jest.fn();

jest.mock("../../../init", () => ({
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
        doc: () => ({ update: jest.fn() }),
      };
      return chain;
    },
  },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("./received-invoice.service", () => ({ getReceivedInvoice }));
jest.mock("../transaction.service", () => ({
  TransactionService: {
    createTransaction: jest.fn(async () => ({ transactionId: "tx", count: 1 })),
  },
}));

import { createTransactionFromReceivedInvoice } from "./received-invoice-transaction.service";

interface IndexField {
  fieldPath: string;
  order?: string;
}

function carregarIndices(): Array<{ collectionGroup: string; fields: IndexField[] }> {
  const arquivo = path.resolve(
    __dirname,
    "..","..","..","..","..","..",
    "firebase",
    "firestore.indexes.json",
  );
  // `utf-8-sig` não existe em Node; o arquivo tem BOM e `JSON.parse` engasga.
  const bruto = fs.readFileSync(arquivo, "utf8").replace(/^﻿/, "");
  return JSON.parse(bruto).indexes ?? [];
}

describe("consulta de duplicatas vs firestore.indexes.json", () => {
  beforeEach(() => {
    chamadas.length = 0;
    getReceivedInvoice.mockResolvedValue({
      id: "t1_c",
      tenantId: "t1",
      chaveAcesso: "1".repeat(44),
      status: "completa",
      emitenteCnpj: "11222333000181",
      emitenteNome: "Alfa",
      dataEmissao: "2026-09-01T10:00:00-03:00",
      valorTotal: 1500,
    });
  });

  it("usa um índice que existe — inclusive na direção", async () => {
    await createTransactionFromReceivedInvoice("t1", "1".repeat(44), "u1", {});

    // Campos na ordem em que a consulta os aplica, sem repetir `date`
    // (o intervalo entra duas vezes: >= e <=).
    const campos: Array<{ fieldPath: string; order: string }> = [];
    for (const c of chamadas) {
      const existente = campos.find((x) => x.fieldPath === c.campo);
      if (existente) {
        // O `orderBy` vem DEPOIS do `where` de intervalo e é ele que manda na
        // direção — sobrescreve o ASC assumido pelo filtro.
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

    // A direção de igualdade não restringe o índice; só a do campo ordenado.
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
        // Igualdade serve em qualquer direção; o campo ORDENADO tem que bater.
        if (campo.fieldPath !== ordenado?.campo) return true;
        return decl.order === campo.order;
      });
    });

    if (!casa) {
      // Jest nao aceita mensagem no `expect` (isso e do Vitest); lancar aqui e
      // o que faz a falha DIZER o que ajustar, em vez de "expected true".
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
});
