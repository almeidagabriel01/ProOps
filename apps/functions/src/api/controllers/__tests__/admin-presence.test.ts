jest.mock("../../../init", () => ({ db: {} }));
jest.mock("../../../lib/tenant-presence", () => ({ listTenantPresence: jest.fn() }));

import { startOfTodayBrasiliaIso } from "../admin-presence.controller";

describe("startOfTodayBrasiliaIso", () => {
  it("o dia de Brasília começa às 03:00 UTC", () => {
    expect(startOfTodayBrasiliaIso(Date.parse("2026-10-07T13:15:00Z"))).toBe("2026-10-07T03:00:00.000Z");
  });

  it("entre 00:00 e 03:00 UTC ainda é o dia anterior em Brasília", () => {
    expect(startOfTodayBrasiliaIso(Date.parse("2026-10-08T01:30:00Z"))).toBe("2026-10-07T03:00:00.000Z");
  });
});
