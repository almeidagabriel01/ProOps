// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * No Perfil aberto pelo super admin, salvar ia por `PUT /v1/profile`, que usa a
 * identidade logada: gravava o nome e o telefone do cliente no doc do próprio
 * super admin. A troca de senha mudaria a senha dele.
 */

const updateProfile = vi.fn();

vi.mock("@/services/user-service", () => ({
  UserService: { updateProfile: (...args: unknown[]) => updateProfile(...args) },
}));
vi.mock("@/lib/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb({ providerData: [{ providerId: "password" }] });
    return () => {};
  },
}));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ accountTenant: null }) }));
vi.mock("../organization-form", () => ({ OrganizationForm: () => <div>organizacao</div> }));
vi.mock("../password-form", () => ({ PasswordForm: () => <div data-testid="password-form" /> }));
vi.mock("@/components/shared/plan-usage-card", () => ({
  PlanUsageCard: () => <div data-testid="plan-usage" />,
}));

import { OverviewTab } from "../OverviewTab";
import type { User } from "@/types";
import type { UsePlanUsageReturn } from "@/hooks/usePlanUsage";

const dono = {
  id: "dono",
  name: "Dono AWA",
  email: "dono@awa.com",
  phoneNumber: "11999990000",
  role: "admin",
} as User;

function renderTab(readOnlyPersonalData?: boolean) {
  render(
    <OverviewTab
      user={dono}
      tenant={null}
      isMaster
      planUsageData={{} as UsePlanUsageReturn}
      readOnlyPersonalData={readOnlyPersonalData}
    />,
  );
}

beforeEach(() => updateProfile.mockReset());

describe("OverviewTab no Perfil visto pelo super admin", () => {
  it("mostra o e-mail da pessoa vista, sem editar nem trocar senha", () => {
    renderTab(true);
    expect(screen.getByDisplayValue("dono@awa.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dono AWA")).toBeDisabled();
    expect(screen.queryByText("Editar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salvar/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("password-form")).not.toBeInTheDocument();
    expect(screen.getByTestId("plan-usage")).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("na própria conta continua editável e com troca de senha", () => {
    renderTab(false);
    expect(screen.getByText("Editar")).toBeInTheDocument();
    expect(screen.getByTestId("password-form")).toBeInTheDocument();
  });
});
