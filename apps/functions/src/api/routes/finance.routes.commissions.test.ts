/**
 * O relatorio de comissoes nasce gateado pelo plano.
 *
 * Foi a falha do fiscal, do calendario e do Asaas: a capacidade vivia so no
 * PlanProvider do frontend, e qualquer chamada HTTP direta passava. Aqui a
 * defesa e o PREFIXO — `router.use("/transactions", financialGate)` —, entao o
 * que este teste prova nao e o middleware (isso e
 * `require-plan-capability.test.ts`), e sim que a rota nova cai DENTRO dele.
 *
 * Uma rota registrada como `/commissions` em vez de `/transactions/commissions`
 * ficaria aberta a qualquer assinante sem erro nenhum, em lugar nenhum.
 *
 * O teste sobe o router de verdade num servidor efemero em vez de espiar
 * `router.stack`: os internos do Express mudam entre versoes maiores, e a
 * pergunta e sobre comportamento.
 */

import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const gatePaths: string[] = [];
const gateCapabilities: string[] = [];

jest.mock("../middleware/require-plan-capability", () => ({
  requirePlanCapability: (capability: string) => {
    gateCapabilities.push(capability);
    return (
      req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) => {
      gatePaths.push(req.originalUrl);
      next();
    };
  },
}));

jest.mock("../middleware/pdf-rate-limiter", () => ({
  pdfRateLimiter: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

const handler =
  (nome: string) => (_req: express.Request, res: express.Response) =>
    res.json({ handler: nome });

jest.mock("../controllers/transactions.controller", () => ({
  createTransaction: handler("createTransaction"),
  updateTransaction: handler("updateTransaction"),
  updateTransactionWithInstallments: handler("updateTransactionWithInstallments"),
  updateTransactionsBatch: handler("updateTransactionsBatch"),
  updateTransactionsStatusBatch: handler("updateTransactionsStatusBatch"),
  updateGroupStatus: handler("updateGroupStatus"),
  deleteTransaction: handler("deleteTransaction"),
  deleteTransactionGroup: handler("deleteTransactionGroup"),
  registerPartialPayment: handler("registerPartialPayment"),
  getTransactionsSummary: handler("getTransactionsSummary"),
  getCommissionReport: handler("getCommissionReport"),
}));

jest.mock("../controllers/wallets.controller", () => ({
  createWallet: handler("createWallet"),
  updateWallet: handler("updateWallet"),
  deleteWallet: handler("deleteWallet"),
  transferValues: handler("transferValues"),
  adjustBalance: handler("adjustBalance"),
}));

jest.mock("../controllers/shared-transactions.controller", () => ({
  createShareLink: handler("createShareLink"),
  getShareLinkInfo: handler("getShareLinkInfo"),
}));

jest.mock("../controllers/transaction-pdf.controller", () => ({
  downloadTransactionPdf: handler("downloadTransactionPdf"),
}));

import { financeRoutes } from "./finance.routes";

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  // Mesmo ponto de montagem do app real (api/index.ts).
  app.use("/v1", financeRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

beforeEach(() => {
  gatePaths.length = 0;
});

describe("rota do relatorio de comissoes", () => {
  it("passa pelo gate de plano do modulo financeiro", async () => {
    const response = await fetch(
      `${baseUrl}/v1/transactions/commissions?month=2026-10`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      handler: "getCommissionReport",
    });
    expect(gatePaths).toContain("/v1/transactions/commissions?month=2026-10");
  });

  it("o gate montado e o do financeiro", () => {
    expect(gateCapabilities).toContain("financial");
  });

  // "commissions" e um path literal: registrado depois de "/transactions/:id"
  // ele seria engolido pelo parametro e viraria uma tentativa de atualizar o
  // lancamento de id "commissions".
  it("nao e engolido pelas rotas /transactions/:id", async () => {
    const response = await fetch(`${baseUrl}/v1/transactions/commissions`);
    const body = (await response.json()) as { handler: string };
    expect(body.handler).toBe("getCommissionReport");
  });

  it("o summary continua funcionando ao lado", async () => {
    const response = await fetch(`${baseUrl}/v1/transactions/summary`);
    const body = (await response.json()) as { handler: string };
    expect(body.handler).toBe("getTransactionsSummary");
  });
});
