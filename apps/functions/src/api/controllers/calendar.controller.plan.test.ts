/**
 * A agenda INTERNA e de todos os planos, entao /calendar/events nao passa pelo
 * gate de plano. A sincronia com o Google Agenda e do Pro para cima: quem
 * perdeu o `calendarSync` e continuou conectado nao pode seguir sincronizando.
 */

process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "true";

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("../../lib/token-encryption", () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
  isEncryptedToken: () => false,
}));
jest.mock("../../init", () => ({ db: { collection: jest.fn() } }));
const tenantHasCapability = jest.fn();
jest.mock("../../lib/tenant-capabilities", () => ({
  tenantHasCapability: (id: string, cap: string) => tenantHasCapability(id, cap),
}));

import { syncEventToGoogle } from "./calendar.controller";
import { db } from "../../init";

it("sem calendarSync nao le a integracao e devolve sincronia desligada", async () => {
  tenantHasCapability.mockResolvedValue(false);

  const result = await syncEventToGoogle("ev1", {
    tenantId: "t1",
    status: "scheduled",
  } as never);

  expect(tenantHasCapability).toHaveBeenCalledWith("t1", "calendarSync");
  expect(db.collection).not.toHaveBeenCalled();
  expect(result).toMatchObject({ enabled: false, status: "disabled" });
});
