// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  plan: { hasClientPortal: true },
  perm: { canEdit: true },
  perms: { isDemo: false },
  get: vi.fn(),
  create: vi.fn(),
  rotate: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perm }));
vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => m.perms }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { name: "Casa Viva" } }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/client-portal-service", () => ({
  ClientPortalService: {
    getLink: (...a: unknown[]) => m.get(...a),
    createLink: (...a: unknown[]) => m.create(...a),
    rotateLink: (...a: unknown[]) => m.rotate(...a),
    revokeLink: (...a: unknown[]) => m.revoke(...a),
  },
}));

import { ClientPortalButton } from "../client-portal-button";

const CLIENT = { id: "c1", name: "Ana Ribeiro", phone: "11988887777", email: "ana@x.com" };
const NO_LINK = { url: null, createdAt: null, lastViewedAt: null, viewCount: 0 };
const WITH_LINK = { url: "https://erp.test/share/portal/abc", createdAt: "2026-09-26", lastViewedAt: null, viewCount: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  m.plan = { hasClientPortal: true };
  m.perm = { canEdit: true };
  m.perms = { isDemo: false };
  m.get.mockResolvedValue(NO_LINK);
  m.create.mockResolvedValue(WITH_LINK);
  m.rotate.mockResolvedValue({ ...WITH_LINK, url: "https://erp.test/share/portal/novo" });
  m.revoke.mockResolvedValue(undefined);
});

async function openDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Portal do cliente" }));
}

describe("portal do cliente na ficha do contato", () => {
  it("cria o link e já mostra a mensagem com o primeiro nome", async () => {
    render(<ClientPortalButton client={CLIENT} />);
    await openDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Criar link do portal" }));
    expect(m.create).toHaveBeenCalledWith("c1");
    expect(await screen.findByText("https://erp.test/share/portal/abc")).toBeInTheDocument();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toMatch(/^Olá, Ana!/);
    expect(screen.getByText("O cliente ainda não abriu o portal.")).toBeInTheDocument();
  });

  it("gerar novo link pede confirmação e troca o link", async () => {
    m.get.mockResolvedValue(WITH_LINK);
    render(<ClientPortalButton client={CLIENT} />);
    await openDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Gerar novo link" }));
    expect(screen.getByText(/O link atual para de abrir na hora/)).toBeInTheDocument();
    expect(m.rotate).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole("button", { name: "Gerar novo link" }).at(-1)!;
    await userEvent.click(confirm);
    await waitFor(() => expect(m.rotate).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText("https://erp.test/share/portal/novo")).toBeInTheDocument();
  });

  it("desligar pede confirmação e volta ao 'Criar link'", async () => {
    m.get.mockResolvedValue(WITH_LINK);
    render(<ClientPortalButton client={CLIENT} />);
    await openDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Desligar portal" }));
    await userEvent.click(screen.getByRole("button", { name: "Desligar" }));
    await waitFor(() => expect(m.revoke).toHaveBeenCalledWith("c1"));
    expect(await screen.findByRole("button", { name: "Criar link do portal" })).toBeInTheDocument();
  });

  it("mostra quantas vezes o cliente abriu", async () => {
    m.get.mockResolvedValue({ ...WITH_LINK, viewCount: 3, lastViewedAt: "2026-09-26T15:00:00.000Z" });
    render(<ClientPortalButton client={CLIENT} />);
    await openDialog();
    expect(await screen.findByText(/Aberto 3 vezes/)).toBeInTheDocument();
  });

  it("quem só vê Contatos não tem o botão", () => {
    m.perm = { canEdit: false };
    render(<ClientPortalButton client={CLIENT} />);
    expect(screen.queryByRole("button", { name: "Portal do cliente" })).toBeNull();
  });

  it("sem o plano não tem o botão", () => {
    m.plan = { hasClientPortal: false };
    render(<ClientPortalButton client={CLIENT} />);
    expect(screen.queryByRole("button", { name: "Portal do cliente" })).toBeNull();
  });

  it("na demonstração abre o exemplo, sem chamar a API", async () => {
    m.perms = { isDemo: true };
    m.perm = { canEdit: false };
    render(<ClientPortalButton client={CLIENT} />);
    await openDialog();
    expect(screen.getByRole("link", { name: /Ver o portal de exemplo/ })).toHaveAttribute(
      "href",
      "/share/portal/exemplo",
    );
    expect(m.get).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Criar link do portal" })).toBeNull();
  });
});
