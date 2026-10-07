import { describe, it, expect } from "vitest";
import { withLivePresence } from "../presence-live";
import type { PresenceInfo } from "../presence-format";

/**
 * A presença do card e da Visão geral vinha só da carga da lista: para ver
 * alguém ficar ausente ou sair era preciso dar F5. A consulta periódica de
 * presença é aplicada por cima da lista, empresa por empresa.
 */

function item(id: string, presence?: PresenceInfo) {
  return { tenant: { id, name: `Empresa ${id}`, presence } };
}

const online: PresenceInfo = {
  status: "online",
  sessionStartedAt: "2026-10-07T13:15:00.000Z",
  lastHeartbeatAt: "2026-10-07T13:40:00.000Z",
};

function snapshot(...tenants: Array<PresenceInfo & { tenantId: string }>) {
  return { tenants };
}

describe("withLivePresence", () => {
  it("sem consulta ainda, devolve a lista como veio", () => {
    const items = [item("a", online)];
    expect(withLivePresence(items, null)).toBe(items);
  });

  it("online que ficou ausente passa a ausente sem recarregar a lista", () => {
    const [result] = withLivePresence(
      [item("a", online)],
      snapshot({ tenantId: "a", ...online, status: "away", lastHeartbeatAt: "2026-10-07T13:46:00.000Z" }),
    );
    expect(result.tenant.presence).toEqual({
      status: "away",
      sessionStartedAt: online.sessionStartedAt,
      lastHeartbeatAt: "2026-10-07T13:46:00.000Z",
    });
    expect(result.tenant.name).toBe("Empresa a");
  });

  it("ausente que voltou a mexer volta a online", () => {
    const [result] = withLivePresence(
      [item("a", { ...online, status: "away" })],
      snapshot({ tenantId: "a", ...online }),
    );
    expect(result.tenant.presence?.status).toBe("online");
  });

  it("online que fechou a aba passa a offline, com a hora em que saiu", () => {
    const [result] = withLivePresence(
      [item("a", online)],
      snapshot({ tenantId: "a", ...online, status: "offline" }),
    );
    expect(result.tenant.presence).toEqual({ ...online, status: "offline" });
  });

  it("empresa sem presença na carga que entrou depois aparece online", () => {
    const [result] = withLivePresence([item("a")], snapshot({ tenantId: "a", ...online }));
    expect(result.tenant.presence).toEqual(online);
  });

  it("fora da consulta e marcada como online na carga: a sessão parou e vira offline", () => {
    const [result] = withLivePresence([item("a", online)], snapshot());
    expect(result.tenant.presence).toEqual({ ...online, status: "offline" });
  });

  it("fora da consulta e já offline (sessão de outro dia): fica como estava", () => {
    const before = item("a", { ...online, status: "offline" });
    const [result] = withLivePresence([before], snapshot());
    expect(result).toBe(before);
  });

  it("sem mudança, mantém o mesmo objeto (não redesenha o card à toa)", () => {
    const before = item("a", online);
    const [result] = withLivePresence([before], snapshot({ tenantId: "a", ...online }));
    expect(result).toBe(before);
  });

  it("cada empresa recebe só a própria presença", () => {
    const result = withLivePresence(
      [item("a"), item("b", online)],
      snapshot({ tenantId: "b", ...online, status: "away" }),
    );
    expect(result[0].tenant.presence).toBeUndefined();
    expect(result[1].tenant.presence?.status).toBe("away");
  });
});
