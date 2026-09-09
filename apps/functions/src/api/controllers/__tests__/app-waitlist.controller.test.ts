const escritas: Array<{ id: string; dados: Record<string, unknown> }> = [];

const mockSet = jest.fn(async () => undefined);

jest.mock("../../../init", () => ({
  db: {
    collection: jest.fn((nome: string) => ({
      doc: (id: string) => ({
        set: (dados: Record<string, unknown>) => {
          escritas.push({ id, dados: { ...dados, __colecao: nome } });
          return mockSet();
        },
      }),
    })),
  },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__timestamp__" },
}));

import type { Request, Response } from "express";
import { joinAppWaitlist } from "../app-waitlist.controller";
import { logger } from "../../../lib/logger";

function resposta() {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  } as unknown as Response & { status: jest.Mock; json: jest.Mock };
  return res;
}

function pedido(body: unknown) {
  return { body } as Request;
}

beforeEach(() => {
  escritas.length = 0;
  jest.clearAllMocks();
});

describe("joinAppWaitlist", () => {
  it("grava o e-mail e responde 200", async () => {
    const res = resposta();
    await joinAppWaitlist(
      pedido({ email: "Alguem@Exemplo.COM", website: "" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(escritas).toHaveLength(1);
    expect(escritas[0].dados).toMatchObject({
      // Normalizado para minúsculas pelo schema, senão o mesmo endereço
      // digitado com outra caixa entraria como uma segunda pessoa.
      email: "alguem@exemplo.com",
      origem: "landing-aplicativo",
      __colecao: "app_waitlist",
    });
  });

  it("usa o mesmo id para o mesmo e-mail, então reenviar não duplica", async () => {
    const res = resposta();
    await joinAppWaitlist(
      pedido({ email: "alguem@exemplo.com", website: "" }),
      res,
    );
    await joinAppWaitlist(
      pedido({ email: "ALGUEM@exemplo.com", website: "" }),
      res,
    );

    expect(escritas).toHaveLength(2);
    expect(escritas[0].id).toBe(escritas[1].id);
    // E o id não é o endereço: um e-mail com barra quebraria o doc id.
    expect(escritas[0].id).not.toContain("@");
    expect(escritas[0].id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejeita e-mail inválido com 400 e não grava nada", async () => {
    const res = resposta();
    await joinAppWaitlist(pedido({ email: "nao-e-email", website: "" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(escritas).toHaveLength(0);
  });

  it("engole o bot do honeypot: responde 200 e não grava", async () => {
    const res = resposta();
    await joinAppWaitlist(
      pedido({ email: "bot@exemplo.com", website: "http://spam" }),
      res,
    );

    // Mesma resposta que uma pessoa recebe. Dizer ao bot que ele foi pego só
    // ensina quem o escreveu a parar de preencher o campo.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(escritas).toHaveLength(0);
  });

  it("nunca escreve o endereço no log", async () => {
    const res = resposta();
    await joinAppWaitlist(
      pedido({ email: "alguem@exemplo.com", website: "" }),
      res,
    );

    const registrado = JSON.stringify((logger.info as jest.Mock).mock.calls);
    expect(registrado).not.toContain("alguem@exemplo.com");
  });

  it("responde 500 quando a escrita falha, sem vazar o erro cru", async () => {
    mockSet.mockRejectedValueOnce(new Error("firestore indisponível"));
    const res = resposta();
    await joinAppWaitlist(
      pedido({ email: "alguem@exemplo.com", website: "" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    const corpo = (res.json as jest.Mock).mock.calls[0][0];
    expect(corpo.message).not.toContain("firestore indisponível");
  });
});
