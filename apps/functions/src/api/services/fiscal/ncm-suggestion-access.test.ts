/**
 * A sugestão de NCM por IA gasta a cota de IA da empresa e não conferia
 * permissão nenhuma: qualquer membro a chamava. Agora pede quem cadastra
 * produto ou serviço, ou quem emite nota.
 */

let permissionDocs: Record<string, Record<string, Record<string, unknown>>>;

jest.mock("../../../init", () => ({
  auth: {},
  db: {
    collection: () => ({
      doc: (uid: string) => ({
        collection: () => ({
          doc: (pageId: string) => ({
            get: async () => {
              const data = permissionDocs[uid]?.[pageId];
              return { exists: !!data, data: () => data };
            },
          }),
        }),
      }),
    }),
  },
}));

import { canRequestNcmSuggestion } from "./ncm-suggestion-access";

beforeEach(() => {
  permissionDocs = {
    tec: { service_orders: { canView: true, canEdit: true } },
    leitor: { products: { canView: true } },
    cadastro: { products: { canView: true, canEdit: true } },
    servicos: { services: { canView: true, canCreate: true } },
    fiscal: { invoices: { canView: true, canCreate: true } },
  };
});

describe("canRequestNcmSuggestion", () => {
  it("técnico e quem só vê Produtos não pedem", async () => {
    await expect(canRequestNcmSuggestion({ uid: "tec", role: "MEMBER" })).resolves.toBe(false);
    await expect(canRequestNcmSuggestion({ uid: "leitor", role: "MEMBER" })).resolves.toBe(false);
  });

  it("quem cadastra produto ou serviço, ou emite nota, pede", async () => {
    await expect(canRequestNcmSuggestion({ uid: "cadastro", role: "MEMBER" })).resolves.toBe(true);
    await expect(canRequestNcmSuggestion({ uid: "servicos", role: "MEMBER" })).resolves.toBe(true);
    await expect(canRequestNcmSuggestion({ uid: "fiscal", role: "MEMBER" })).resolves.toBe(true);
  });

  it("dono e administradores pedem sem doc de permissão", async () => {
    await expect(canRequestNcmSuggestion({ uid: "dono", role: "MASTER" })).resolves.toBe(true);
    await expect(canRequestNcmSuggestion({ uid: "adm", role: "ADMIN" })).resolves.toBe(true);
  });
});
