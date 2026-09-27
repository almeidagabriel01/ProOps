// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  perms: { isMaster: true, isDemo: false },
  get: vi.fn(),
  create: vi.fn(),
  rotate: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => m.perms }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { name: "Casa Viva" } }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/accountant-service", () => ({
  AccountantService: {
    getLink: (...a: unknown[]) => m.get(...a),
    createLink: (...a: unknown[]) => m.create(...a),
    rotateLink: (...a: unknown[]) => m.rotate(...a),
    revokeLink: (...a: unknown[]) => m.revoke(...a),
  },
}));

import { AccountantLinkButton } from "../_components/accountant-link-button";

const LINK = { url: "https://erp.test/share/contador/abc", createdAt: "x", lastViewedAt: null, viewCount: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  m.perms = { isMaster: true, isDemo: false };
  m.get.mockResolvedValue({ url: null, createdAt: null, lastViewedAt: null, viewCount: 0 });
  m.create.mockResolvedValue(LINK);
  m.rotate.mockResolvedValue({ ...LINK, url: "https://erp.test/share/contador/novo" });
});

describe("link do contador no DRE", () => {
  it("o dono cria o link e já tem a mensagem para mandar", async () => {
    render(<AccountantLinkButton />);
    await userEvent.click(screen.getByRole("button", { name: "Link do contador" }));
    await userEvent.click(await screen.findByRole("button", { name: "Criar link do contador" }));
    expect(await screen.findByText(LINK.url)).toBeInTheDocument();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toMatch(/só leitura/);
  });

  it("gerar novo link pede confirmação", async () => {
    m.get.mockResolvedValue(LINK);
    render(<AccountantLinkButton />);
    await userEvent.click(screen.getByRole("button", { name: "Link do contador" }));
    await userEvent.click(await screen.findByRole("button", { name: "Gerar novo link" }));
    expect(m.rotate).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Gerar novo link" }).at(-1)!);
    await waitFor(() => expect(m.rotate).toHaveBeenCalled());
  });

  it("membro não tem o botão", () => {
    m.perms = { isMaster: false, isDemo: false };
    render(<AccountantLinkButton />);
    expect(screen.queryByRole("button", { name: "Link do contador" })).toBeNull();
  });

  it("demonstração abre o exemplo, sem API", async () => {
    m.perms = { isMaster: false, isDemo: true };
    render(<AccountantLinkButton />);
    await userEvent.click(screen.getByRole("button", { name: "Link do contador" }));
    expect(screen.getByRole("link", { name: /Ver o exemplo/ })).toHaveAttribute("href", "/share/contador/exemplo");
    expect(m.get).not.toHaveBeenCalled();
  });
});
