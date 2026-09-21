process.env.NODE_ENV = "test";

const docs = ["a", "b", "c"].map((id, i) => ({
  id,
  data: () => ({
    status: "unresolved",
    severity: "error",
    source: "web",
    errorType: "TypeError",
    title: `erro ${id}`,
    lastSeen: `2026-06-2${3 - i}T00:00:00Z`,
  }),
}));

jest.mock("../../../init", () => {
  const chain: Record<string, unknown> = {};
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  chain.startAfter = () => chain;
  chain.get = async () => ({ docs });
  return { db: { collection: () => chain }, auth: {}, adminApp: {} };
});
jest.mock("../../../lib/observability/error-ingest.service", () => ({
  ERROR_ISSUES_COLLECTION: "error_issues",
}));
jest.mock("../../../lib/request-auth", () => ({ isSuperAdminClaim: () => true }));

import { searchIssues } from "../observability-admin.controller";

function run(query: Record<string, string>) {
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  return searchIssues({ query } as never, res as never).then(() => json.mock.calls[0][0]);
}

it("pagina cheia antes do fim da varredura devolve cursor (o resto era inalcancavel)", async () => {
  const body = await run({ limit: "2" });
  expect(body.issues).toHaveLength(2);
  expect(body.nextCursor).toBeTruthy();
});

it("varredura esgotada sem encher a pagina nao devolve cursor", async () => {
  const body = await run({ limit: "5" });
  expect(body.issues).toHaveLength(3);
  expect(body.nextCursor).toBeNull();
});

it("pagina que enche exatamente no ultimo doc nao inventa cursor", async () => {
  const body = await run({ limit: "3" });
  expect(body.issues).toHaveLength(3);
  expect(body.nextCursor).toBeNull();
});
