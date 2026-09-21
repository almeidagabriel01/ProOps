// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Desativar / reativar / excluir definitivamente no card da empresa.
 * O botao de lixeira apagava a empresa na hora; agora o primeiro passo e
 * desativar, e excluir so aparece para empresa desativada, com o nome digitado.
 */

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/services/admin-service", () => ({
  AdminService: { resetMemberMfa: vi.fn() },
}));

import { TenantCard } from "../tenant-card";
import type { TenantBillingInfo } from "@/services/admin-service";

function item(accountStatus?: string): TenantBillingInfo {
  return {
    tenant: { id: "t1", name: "Cortinas Silva", createdAt: "2026-03-18", accountStatus },
    admin: { id: "u1", email: "a@b.com", currentPeriodEnd: "2026-12-01" },
    planName: "Pro",
    planId: "pro",
    subscriptionStatus: "active",
    billingInterval: "monthly",
    usage: { users: 0, proposals: 0, clients: 0, products: 0, transactions: 0, wallets: 0, calendarEvents: 0 },
  } as TenantBillingInfo;
}

const onDeactivate = vi.fn().mockResolvedValue(undefined);
const onReactivate = vi.fn().mockResolvedValue(undefined);
const onPurge = vi.fn().mockResolvedValue(undefined);
const onLoginAs = vi.fn();

function renderCard(data: TenantBillingInfo) {
  return render(
    <TenantCard
      item={data}
      onEdit={vi.fn()}
      onDeactivate={onDeactivate}
      onReactivate={onReactivate}
      onPurge={onPurge}
      onLoginAs={onLoginAs}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TenantCard: ciclo de vida da empresa", () => {
  it("empresa ativa oferece desativar, e nao excluir direto", () => {
    renderCard(item());
    expect(screen.getByTitle("Desativar empresa")).toBeInTheDocument();
    expect(screen.queryByTitle("Excluir definitivamente")).not.toBeInTheDocument();
  });

  it("desativar pede confirmacao antes de chamar", async () => {
    renderCard(item());
    fireEvent.click(screen.getByTitle("Desativar empresa"));
    expect(onDeactivate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(onDeactivate).toHaveBeenCalledWith("t1"));
  });

  it("empresa desativada: banner, reativar, excluir e painel bloqueado", () => {
    renderCard(item("deactivated"));
    expect(screen.getByText("Empresa desativada")).toBeInTheDocument();
    expect(screen.getByTitle("Reativar empresa")).toBeInTheDocument();
    expect(screen.getByTitle("Excluir definitivamente")).toBeInTheDocument();
    const access = screen.getByRole("button", { name: /Acessar Painel/i });
    expect(access).toBeDisabled();
  });

  it("excluir so libera com o nome da empresa digitado", async () => {
    renderCard(item("deactivated"));
    fireEvent.click(screen.getByTitle("Excluir definitivamente"));
    const confirm = await screen.findByRole("button", { name: "Excluir definitivamente" });
    expect(confirm).toBeDisabled();

    const input = screen.getByLabelText("Nome da empresa para confirmar a exclusão");
    fireEvent.change(input, { target: { value: "Cortinas" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "cortinas silva" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(onPurge).toHaveBeenCalledWith("t1", "cortinas silva"));
  });

  it("empresa em exclusao nao mostra acoes de ciclo de vida", () => {
    renderCard(item("purging"));
    expect(screen.getByText("Exclusão em andamento")).toBeInTheDocument();
    expect(screen.queryByTitle("Desativar empresa")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Reativar empresa")).not.toBeInTheDocument();
  });
});
