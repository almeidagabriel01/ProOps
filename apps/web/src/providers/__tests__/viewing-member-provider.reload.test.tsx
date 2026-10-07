// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

/**
 * Trocar de membro pelo seletor da faixa recarrega a página. Logo depois da
 * recarga o usuário ainda não chegou, e o provider concluía "não é superadmin"
 * e apagava o membro da sessão: a tela voltava sempre para a visão do dono.
 */

let auth: { user: { id: string; role: string } | null; isLoading: boolean } = {
  user: null,
  isLoading: true,
};
const getTenantMembers = vi.fn();

vi.mock("@/providers/auth-provider", () => ({ useAuth: () => auth }));
vi.mock("@/services/admin-service", () => ({
  AdminService: {
    getTenantMembers: (id: string) => getTenantMembers(id),
    startImpersonation: vi.fn().mockResolvedValue(undefined),
    stopImpersonation: vi.fn().mockResolvedValue(undefined),
  },
}));

import { ViewingMemberProvider, useViewingMember } from "../viewing-member-provider";

function Probe() {
  const { member, isLoading } = useViewingMember();
  return (
    <div data-testid="probe" data-loading={String(isLoading)}>
      {member?.name ?? "empresa"}
    </div>
  );
}

const franciele = {
  id: "franciele",
  name: "Franciele",
  email: "f@awa.com",
  role: "MEMBER",
  masterId: "dono",
  isOwner: false,
  createdAt: null,
  permissions: {},
};

function renderProvider() {
  return render(
    <ViewingMemberProvider>
      <Probe />
    </ViewingMemberProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("viewingAsTenant", "awa");
  sessionStorage.setItem("viewingAsMember", "awa:franciele");
  getTenantMembers.mockReset().mockResolvedValue([
    { ...franciele, id: "dono", name: "Dono", isOwner: true, role: "ADMIN" },
    franciele,
  ]);
});

describe("ViewingMemberProvider depois de recarregar a página", () => {
  it("espera o login e mantém o membro escolhido", async () => {
    auth = { user: null, isLoading: true };
    const view = renderProvider();
    expect(screen.getByTestId("probe")).toHaveAttribute("data-loading", "true");
    expect(sessionStorage.getItem("viewingAsMember")).toBe("awa:franciele");

    auth = { user: { id: "root", role: "superadmin" }, isLoading: false };
    act(() => view.rerender(
      <ViewingMemberProvider>
        <Probe />
      </ViewingMemberProvider>,
    ));

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("Franciele"));
    expect(screen.getByTestId("probe")).toHaveAttribute("data-loading", "false");
    expect(sessionStorage.getItem("viewingAsMember")).toBe("awa:franciele");
  });

  it("quem não é superadmin, já com o login carregado, perde o membro da sessão", async () => {
    auth = { user: { id: "u1", role: "admin" }, isLoading: false };
    renderProvider();
    await waitFor(() => expect(sessionStorage.getItem("viewingAsMember")).toBeNull());
    expect(screen.getByTestId("probe")).toHaveTextContent("empresa");
  });

  it("sessão sem login (saiu da conta) também limpa o membro", async () => {
    auth = { user: null, isLoading: false };
    renderProvider();
    await waitFor(() => expect(sessionStorage.getItem("viewingAsMember")).toBeNull());
  });

  it("membro que saiu da empresa cai na visão da empresa", async () => {
    auth = { user: { id: "root", role: "superadmin" }, isLoading: false };
    getTenantMembers.mockResolvedValue([{ ...franciele, id: "dono", isOwner: true }]);
    renderProvider();
    await waitFor(() => expect(sessionStorage.getItem("viewingAsMember")).toBeNull());
    expect(screen.getByTestId("probe")).toHaveTextContent("empresa");
  });
});
