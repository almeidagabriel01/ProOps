/**
 * Route-table tests for pdfApp — the dedicated PDF Cloud Function.
 * Guarantees: the 4 PDF routes exist, public share routes are registered
 * BEFORE the auth barrier, and authenticated routes come after it.
 */

jest.mock("./api/middleware/auth", () => ({
  validateFirebaseIdToken: function validateFirebaseIdToken() {
    /* mocked */
  },
}));
jest.mock("./api/middleware/pdf-rate-limiter", () => ({
  pdfRateLimiter: function pdfRateLimiter() {
    /* mocked */
  },
}));
jest.mock("./api/controllers/shared-proposal-pdf.controller", () => ({
  downloadSharedProposalPdf: jest.fn(),
}));
jest.mock("./api/controllers/shared-transaction-pdf.controller", () => ({
  downloadSharedTransactionPdf: jest.fn(),
}));
jest.mock("./api/controllers/proposal-pdf.controller", () => ({
  downloadProposalPdf: jest.fn(),
}));
jest.mock("./api/controllers/transaction-pdf.controller", () => ({
  downloadTransactionPdf: jest.fn(),
}));
jest.mock("./lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { pdfApp } from "./pdfApp";

type Layer = {
  name?: string;
  route?: { path?: string };
};

function getStack(): Layer[] {
  const app = pdfApp as unknown as {
    router?: { stack: Layer[] };
    _router?: { stack: Layer[] };
  };
  return app.router?.stack ?? app._router?.stack ?? [];
}

describe("pdfApp route table", () => {
  const stack = getStack();
  const routePaths = stack
    .filter((l) => l.route?.path)
    .map((l) => String(l.route!.path));

  it("registers the 4 PDF routes", () => {
    expect(routePaths).toEqual(
      expect.arrayContaining([
        "/v1/share/:token/pdf",
        "/v1/share/transaction/:token/pdf",
        "/v1/proposals/:id/pdf",
        "/v1/transactions/:id/pdf",
      ]),
    );
  });

  it("public share routes come before the auth barrier; authed routes after", () => {
    const indexOfRoute = (path: string) =>
      stack.findIndex((l) => l.route?.path === path);
    const indexOfAuth = stack.findIndex(
      (l) => l.name === "validateFirebaseIdToken",
    );

    expect(indexOfAuth).toBeGreaterThan(-1);
    expect(indexOfRoute("/v1/share/:token/pdf")).toBeLessThan(indexOfAuth);
    expect(indexOfRoute("/v1/share/transaction/:token/pdf")).toBeLessThan(indexOfAuth);
    expect(indexOfRoute("/v1/proposals/:id/pdf")).toBeGreaterThan(indexOfAuth);
    expect(indexOfRoute("/v1/transactions/:id/pdf")).toBeGreaterThan(indexOfAuth);
  });
});
