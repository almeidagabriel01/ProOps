// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { PresenceSnapshot } from "@/services/admin-service";

/**
 * Tela "Online" do painel: quem está usando agora, separado de quem passou
 * hoje e já saiu, com cada pessoa e a última sessão.
 */

let snapshot: PresenceSnapshot | null = null;

vi.mock("@/hooks/use-online-presence", () => ({
  useOnlinePresence: () => ({ data: snapshot, isLoading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@/components/admin/activity/tenant-activity-drawer", () => ({
  TenantActivityDrawer: () => null,
}));

import AdminOnlinePage from "../page";

const iso = (s: string) => `2026-10-07T${s}:00.000Z`;

// Os horários do snapshot são de 07/10; com o relógio em outro dia a tela
// escreveria "07/10 10:15" em vez de "10:15". Só o Date é fixado.
afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T14:00:00.000Z"));
  snapshot = {
    now: iso("14:00"),
    since: iso("03:00"),
    tenants: [
      {
        tenantId: "awa",
        tenantName: "AWA",
        status: "online",
        sessionStartedAt: iso("13:15"),
        lastHeartbeatAt: iso("13:59"),
        people: [
          {
            uid: "ana",
            name: "Ana",
            email: "ana@awa.com",
            role: "member",
            status: "online",
            sessionStartedAt: iso("13:15"),
            lastHeartbeatAt: iso("13:59"),
            lastActiveAt: iso("13:59"),
          },
          {
            uid: "bia",
            name: "Bia",
            email: "bia@awa.com",
            role: "admin",
            status: "away",
            sessionStartedAt: iso("13:30"),
            lastHeartbeatAt: iso("13:59"),
            lastActiveAt: iso("13:40"),
          },
        ],
      },
      {
        tenantId: "casa",
        tenantName: "Casa Smart",
        status: "offline",
        sessionStartedAt: iso("13:15"),
        lastHeartbeatAt: iso("13:20"),
        people: [
          {
            uid: "caio",
            name: "Caio",
            email: "caio@casa.com",
            role: "master",
            status: "offline",
            sessionStartedAt: iso("13:15"),
            lastHeartbeatAt: iso("13:20"),
            lastActiveAt: iso("13:20"),
          },
        ],
      },
    ],
  };
});

describe("AdminOnlinePage", () => {
  it("separa quem está agora de quem já saiu, com a sessão de cada pessoa", () => {
    render(<AdminOnlinePage />);
    const cards = screen.getAllByTestId("presence-tenant");
    expect(cards.map((c) => c.getAttribute("data-status"))).toEqual(["online", "offline"]);

    expect(within(cards[0]).getByText("AWA")).toBeInTheDocument();
    expect(within(cards[0]).getByText("1 online, 1 ausente")).toBeInTheDocument();
    expect(within(cards[0]).getAllByText("Online desde 10:15").length).toBeGreaterThan(0);
    expect(within(cards[0]).getByText("Ausente, entrou 10:30")).toBeInTheDocument();

    expect(screen.getByText("Passaram hoje e já saíram")).toBeInTheDocument();
    expect(within(cards[1]).getAllByText("Saiu 10:20, ficou 5 min").length).toBeGreaterThan(0);
    expect(within(cards[1]).getByText("Dono")).toBeInTheDocument();

    const summary = screen.getByTestId("presence-summary");
    expect(summary).toHaveTextContent("1online");
    expect(summary).toHaveTextContent("1ausentes");
    expect(summary).toHaveTextContent("2empresas hoje");
  });

  it("ninguém agora", () => {
    snapshot = { now: iso("14:00"), since: iso("03:00"), tenants: [] };
    render(<AdminOnlinePage />);
    expect(screen.getByText("Ninguém está usando o ERP neste momento.")).toBeInTheDocument();
  });
});
