/**
 * A Lia filtrava a busca de contatos e propostas só entre os N registros mais
 * recentes: "ache o João" falhava sempre que o João era antigo. Com termo, a
 * busca agora vai pelo índice searchTokens, refina por todas as palavras e só
 * então ordena e corta.
 */

type Row = { id: string; data: Record<string, unknown> };
let rows: Record<string, Row[]>;
const queries: Array<{ collection: string; wheres: unknown[][]; orderBy: unknown[] | null }> = [];

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => {
      const build = (wheres: unknown[][], orderBy: unknown[] | null): unknown => ({
        where: (...args: unknown[]) => build([...wheres, args], orderBy),
        orderBy: (...args: unknown[]) => build(wheres, args),
        limit: () => build(wheres, orderBy),
        get: async () => {
          queries.push({ collection: name, wheres, orderBy });
          const token = wheres.find((w) => w[1] === "array-contains")?.[2] as string | undefined;
          const docs = (rows[name] || [])
            .filter((r) => !token || (r.data.searchTokens as string[]).includes(token))
            .map((r) => ({ id: r.id, data: () => r.data }));
          return { docs };
        },
      });
      return build([], null);
    },
  },
}));

import { listContacts } from "../contacts.service";
import { listProposals } from "../proposals.service";
import { buildClientSearchTokens, buildSearchTokens } from "../../../lib/search-tokens";

const contact = (id: string, name: string, phone: string, createdAt: string): Row => ({
  id,
  data: { tenantId: "t1", name, phone, createdAt, searchTokens: buildClientSearchTokens(name, "", phone) },
});

beforeEach(() => {
  queries.length = 0;
  rows = {
    clients: [
      contact("c1", "João Silva", "(35) 99999-1234", "2024-01-01"),
      contact("c2", "João Pereira", "(11) 3333-4444", "2026-09-01"),
      contact("c3", "Maria Souza", "(35) 98888-0000", "2026-09-20"),
    ],
    proposals: [
      { id: "p1", data: { tenantId: "t1", title: "Casa Praia", clientName: "João", status: "draft", createdAt: "2025-01-01", searchTokens: buildSearchTokens("Casa Praia", "João") } },
      { id: "p2", data: { tenantId: "t1", title: "Casa Campo", clientName: "Ana", status: "sent", createdAt: "2026-01-01", searchTokens: buildSearchTokens("Casa Campo", "Ana") } },
    ],
  };
});

describe("listContacts com busca", () => {
  it("consulta pelo índice, exige todas as palavras e ordena depois", async () => {
    const result = await listContacts("t1", { search: "joão silva" });
    expect(queries[0].wheres).toContainEqual(["searchTokens", "array-contains", "joao"]);
    expect(queries[0].orderBy).toBeNull();
    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("ordena pelo campo pedido e corta no limite", async () => {
    const result = await listContacts("t1", { search: "joão", limit: 1 });
    expect(result.map((c) => c.id)).toEqual(["c2"]);
  });

  it("acha pelo telefone", async () => {
    const result = await listContacts("t1", { search: "(35) 99999" });
    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("sem termo mantém a listagem ordenada no servidor", async () => {
    await listContacts("t1", {});
    expect(queries[0].orderBy).toEqual(["createdAt", "desc"]);
  });
});

describe("listProposals com busca", () => {
  it("consulta pelo índice e aplica o status em memória", async () => {
    const all = await listProposals("t1", { search: "casa" });
    expect(all.map((p) => p.id)).toEqual(["p2", "p1"]);
    const sent = await listProposals("t1", { search: "casa", status: "sent" });
    expect(sent.map((p) => p.id)).toEqual(["p2"]);
    expect(queries[0].wheres).toContainEqual(["searchTokens", "array-contains", "casa"]);
  });
});
