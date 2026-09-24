jest.mock("firebase-functions/v2/storage", () => ({
  onObjectFinalized: (_o: unknown, fn: unknown) => fn,
  onObjectDeleted: (_o: unknown, fn: unknown) => fn,
}));
jest.mock("./lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const applyStorageDelta = jest.fn(async (_input: unknown) => undefined);
jest.mock("./lib/tenant-storage-usage", () => ({
  applyStorageDelta: (input: unknown) => applyStorageDelta(input),
}));

import { onTenantStorageDeleted, onTenantStorageFinalized } from "./onTenantStorageChange";

type Handler = (event: unknown) => Promise<void>;
const finalized = onTenantStorageFinalized as unknown as Handler;
const deleted = onTenantStorageDeleted as unknown as Handler;

const event = (name: string, size = "1000") => ({ id: "ev1", data: { name, size } });

beforeEach(() => jest.clearAllMocks());

it("upload de imagem de produto soma o tamanho", async () => {
  await finalized(event("tenants/t1/products/p1/a.png"));
  expect(applyStorageDelta).toHaveBeenCalledWith({ tenantId: "t1", deltaBytes: 1000, eventId: "ev1" });
});

it("arquivo apagado subtrai", async () => {
  await deleted(event("tenants/t1/proposals/pr1/attachments/a.pdf", "500"));
  expect(applyStorageDelta).toHaveBeenCalledWith({ tenantId: "t1", deltaBytes: -500, eventId: "ev1" });
});

it("PDF gerado e arquivo fiscal nao passam pela contagem", async () => {
  await finalized(event("tenants/t1/proposals/pr1/pdf/proposal.pdf"));
  await finalized(event("tenants/t1/fiscal/n1/nota.xml"));
  expect(applyStorageDelta).not.toHaveBeenCalled();
});

it("falha relanca para o Eventarc reentregar", async () => {
  applyStorageDelta.mockRejectedValueOnce(new Error("firestore fora"));
  await expect(finalized(event("tenants/t1/products/p1/a.png"))).rejects.toThrow("firestore fora");
});
