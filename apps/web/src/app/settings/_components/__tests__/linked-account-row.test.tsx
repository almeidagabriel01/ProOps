// @vitest-environment jsdom
/**
 * Contas vinculadas: cada linha tem que dizer o estado sem ambiguidade, e só
 * oferecer ação a quem pode agir. Um membro vê que a conexão caiu, mas o botão
 * de reconectar o levaria a uma tela que o recusa.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  describePlanRequirement,
  LinkedAccountRow,
  summarizeLinkedAccounts,
} from "../linked-account-row";
import type {
  LinkedAccount,
  LinkedAccountStatus,
} from "@/services/linked-accounts-service";

function account(overrides: Partial<LinkedAccount> = {}): LinkedAccount {
  return {
    id: "google_drive",
    scope: "tenant",
    status: "connected",
    accountLabel: "drive@empresa.com",
    accountDetail: "Pasta: ProOps",
    connectedAt: "2026-08-02T10:00:00.000Z",
    lastActivityAt: null,
    issue: null,
    notice: null,
    plan: { availableInPlan: true, minimumTier: null, addonAvailable: false },
    canManage: true,
    manageHref: "/settings/drive",
    ...overrides,
  };
}

function renderRow(overrides: Partial<LinkedAccount> = {}) {
  return render(
    <ul>
      <LinkedAccountRow account={account(overrides)} />
    </ul>,
  );
}

describe("LinkedAccountRow", () => {
  it.each<[LinkedAccountStatus, string]>([
    ["connected", "Conectado"],
    ["attention", "Precisa de atenção"],
    ["needs_reconnect", "Reconectar"],
    ["disconnected", "Não conectado"],
    ["not_in_plan", "Fora do plano"],
    ["platform_unavailable", "Indisponível"],
  ])("status %s mostra o selo %s", (status, label) => {
    renderRow({ status });
    const row = screen.getByTestId("linked-account-google_drive");
    expect(row).toHaveAttribute("data-status", status);
    expect(row.querySelector("span.rounded-full")).toHaveTextContent(label);
  });

  it("conectado mostra a conta, o detalhe e a data", () => {
    renderRow();
    expect(screen.getByText("drive@empresa.com")).toBeInTheDocument();
    expect(screen.getByText(/Pasta: ProOps/)).toBeInTheDocument();
    expect(screen.getByText(/Conectado em/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gerenciar" })).toHaveAttribute(
      "href",
      "/settings/drive",
    );
  });

  it("precisa reconectar: mostra o motivo e o botão Reconectar para quem gerencia", () => {
    renderRow({
      status: "needs_reconnect",
      issue: "O Google revogou o acesso da ProOps ao Drive.",
    });
    expect(screen.getByText(/revogou o acesso/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconectar" })).toHaveAttribute(
      "href",
      "/settings/drive",
    );
  });

  it("membro sem permissão vê o problema, mas nenhuma ação, e é orientado a pedir ao administrador", () => {
    renderRow({
      status: "needs_reconnect",
      issue: "O Google revogou o acesso da ProOps ao Drive.",
      canManage: false,
    });
    expect(screen.getByText(/revogou o acesso/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/Peça ao administrador/)).toBeInTheDocument();
  });

  it("membro sem permissão numa integração conectada não vê Gerenciar", () => {
    renderRow({ canManage: false });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("desconectado mostra a descrição da integração e Conectar", () => {
    renderRow({
      status: "disconnected",
      accountLabel: null,
      accountDetail: null,
      connectedAt: null,
    });
    expect(screen.getByText(/pasta de cada cliente/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conectar" })).toBeInTheDocument();
  });

  it("fora do plano leva ao upgrade, inclusive para membro", () => {
    renderRow({
      status: "not_in_plan",
      accountLabel: null,
      connectedAt: null,
      canManage: false,
      plan: { availableInPlan: false, minimumTier: "pro", addonAvailable: false },
    });
    expect(screen.getByText("Disponível a partir do plano Pro.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute(
      "href",
      "/profile?tab=billing",
    );
  });

  it("etapa em andamento aparece como aviso neutro, sem selo de problema", () => {
    renderRow({
      id: "fiscal",
      notice: "Aguardando a primeira nota autorizada para liberar a emissão real.",
      manageHref: "/settings/fiscal",
    });
    const row = screen.getByTestId("linked-account-fiscal");
    expect(row).toHaveAttribute("data-status", "connected");
    expect(screen.getByText(/primeira nota autorizada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gerenciar" })).toBeInTheDocument();
  });

  it("indisponível na plataforma não oferece ação", () => {
    renderRow({ status: "platform_unavailable", accountLabel: null, connectedAt: null });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("WhatsApp é marcado como só do usuário", () => {
    renderRow({
      id: "whatsapp",
      scope: "user",
      accountLabel: "•••• 4321",
      accountDetail: null,
      connectedAt: null,
      manageHref: "/profile",
    });
    expect(screen.getByText("Só você")).toBeInTheDocument();
    expect(screen.getByText("•••• 4321")).toBeInTheDocument();
  });
});

describe("describePlanRequirement", () => {
  it.each([
    [{ minimumTier: "enterprise", addonAvailable: true }, "Disponível no plano Enterprise ou como add-on no seu plano."],
    [{ minimumTier: "pro", addonAvailable: false }, "Disponível a partir do plano Pro."],
    [{ minimumTier: null, addonAvailable: true }, "Disponível como add-on no seu plano."],
    [{ minimumTier: null, addonAvailable: false }, "Não disponível no seu plano."],
  ] as const)("%o", (plan, expected) => {
    expect(describePlanRequirement({ availableInPlan: false, ...plan })).toBe(expected);
  });
});

describe("summarizeLinkedAccounts", () => {
  it("conta as conectadas e as que pedem atenção", () => {
    const list = [
      account({ status: "connected" }),
      account({ status: "connected" }),
      account({ status: "needs_reconnect" }),
      account({ status: "attention" }),
      account({ status: "disconnected" }),
    ];
    expect(summarizeLinkedAccounts(list)).toBe("2 conectadas, 2 precisam de atenção");
  });

  it("singular e sem problemas", () => {
    expect(summarizeLinkedAccounts([account()])).toBe("1 conectada");
  });
});
