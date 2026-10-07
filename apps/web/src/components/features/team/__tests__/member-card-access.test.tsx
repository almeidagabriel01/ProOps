// @vitest-environment jsdom
/**
 * Suspender, reativar e "sair de todos os aparelhos" no card do membro: cada
 * ação pede confirmação, chama a API certa e recarrega a lista. O suspenso
 * aparece com o selo e com "Reativar" no lugar de "Suspender".
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const api = vi.hoisted(() => ({
  suspend: vi.fn(async () => undefined),
  reactivate: vi.fn(async () => undefined),
  revokeSessions: vi.fn(async () => undefined),
}));

vi.mock("@/services/member-access-service", () => ({ MemberAccessService: api }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => ({ hasFinancial: true }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../member-modals", () => ({
  EditMemberModal: () => null,
  DeleteMemberDialog: () => null,
  ResetMfaDialog: () => null,
}));
vi.mock("../apply-permissions-dialog", () => ({ ApplyPermissionsDialog: () => null }));
vi.mock("../permission-editor", () => ({ PermissionEditor: () => null }));

import { MemberCard } from "../member-card";

const MEMBER = {
  id: "vend",
  name: "Carla",
  email: "carla@empresa.com",
  role: "MEMBER",
  createdAt: "2026-10-01",
  permissions: {},
};

function renderCard(status?: "active" | "suspended") {
  const onRefresh = vi.fn();
  render(
    <MemberCard
      member={{ ...MEMBER, status }}
      otherMembers={[]}
      onUpdatePermission={vi.fn()}
      onPermissionsReplaced={vi.fn()}
      saving={false}
      updatingKey={null}
      onRefresh={onRefresh}
    />,
  );
  return { onRefresh };
}

beforeEach(() => vi.clearAllMocks());

describe("acesso do membro no card", () => {
  it("suspender pede confirmação, chama a API e recarrega", async () => {
    const { onRefresh } = renderCard("active");
    await userEvent.click(screen.getByRole("button", { name: "Suspender Carla" }));
    await userEvent.click(await screen.findByRole("button", { name: "Suspender" }));
    await waitFor(() => expect(api.suspend).toHaveBeenCalledWith("vend"));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("encerrar sessões chama a revogação, sem suspender", async () => {
    renderCard("active");
    await userEvent.click(screen.getByRole("button", { name: "Encerrar as sessões de Carla" }));
    await userEvent.click(await screen.findByRole("button", { name: "Encerrar sessões" }));
    await waitFor(() => expect(api.revokeSessions).toHaveBeenCalledWith("vend"));
    expect(api.suspend).not.toHaveBeenCalled();
  });

  it("o suspenso aparece com o selo e com Reativar", async () => {
    renderCard("suspended");
    expect(screen.getByText("Suspenso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Encerrar as sessões de Carla" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reativar Carla" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reativar" }));
    await waitFor(() => expect(api.reactivate).toHaveBeenCalledWith("vend"));
  });
});
