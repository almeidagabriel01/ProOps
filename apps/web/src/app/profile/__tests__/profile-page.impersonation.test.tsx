// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * A página de Perfil inteira no painel visto pelo super admin: no Acessar
 * Painel ela é do dono; no Ver como membro, do membro escolhido, e nunca do
 * dono no lugar dele.
 */

type Person = { id: string; name: string; email: string; role: string; planId?: string };

const superadmin: Person = { id: "root", name: "Suporte", email: "suporte@proops.com.br", role: "superadmin" };
const dono: Person = { id: "dono", name: "Dono AWA", email: "dono@awa.com", role: "admin", planId: "pro" };
const membro: Person = { id: "membro", name: "Vendedora", email: "vendedora@awa.com", role: "member" };

let viewingMember: (Person & { masterId: string | null; isOwner: boolean; permissions: object; createdAt: null }) | null = null;

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: superadmin, isLoading: false }) }));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "awa", name: "AWA" }, accountTenant: null, isLoading: false }),
}));
vi.mock("@/providers/viewing-member-provider", () => ({
  useViewingMember: () => ({ member: viewingMember, isLoading: false }),
}));
vi.mock("@/providers/permissions-provider", () => ({
  usePermissions: () => ({ isMaster: viewingMember === null, isDemo: false }),
}));
vi.mock("@/hooks/useDisplayTenant", () => ({ useDisplayTenant: () => ({ tenant: null }) }));
vi.mock("@/hooks/usePlanUsage", () => ({ usePlanUsage: () => ({ isLoading: false }) }));
vi.mock("@/hooks/usePlanLimits", () => ({
  usePlanLimits: () => ({ purchasedAddons: [], purchasedAddonsData: [], refreshAddons: vi.fn() }),
}));
vi.mock("@/services/plan-service", () => ({
  PlanService: {
    getPlans: vi.fn().mockResolvedValue([]),
    getPlanById: vi.fn().mockResolvedValue(null),
    getLivePlans: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/services/user-service", () => ({
  UserService: {
    getTenantOwnerUser: vi.fn(() => Promise.resolve(dono)),
    getUserById: vi.fn((id: string) => Promise.resolve(id === "membro" ? membro : null)),
  },
}));
vi.mock("@/components/profile", () => ({
  ProfileHeader: ({ user }: { user: Person | null }) => <div data-testid="header-email">{user?.email}</div>,
  OverviewTab: ({ user, readOnlyPersonalData }: { user: Person | null; readOnlyPersonalData?: boolean }) => (
    <div data-testid="overview" data-readonly={String(Boolean(readOnlyPersonalData))}>{user?.email}</div>
  ),
  MySubscriptionTab: () => null,
  BillingTab: () => null,
  PlanChangeDialog: () => null,
  ImpersonatedProfileNotice: ({ mode, personName }: { mode: string; personName: string | null }) => (
    <div data-testid="notice" data-mode={mode}>{personName}</div>
  ),
}));

import ProfilePage from "../page";

beforeEach(() => {
  viewingMember = null;
});

describe("Perfil no painel visto pelo super admin", () => {
  it("Acessar Painel: perfil do dono, somente leitura", async () => {
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByTestId("header-email")).toHaveTextContent("dono@awa.com"));
    expect(screen.getByTestId("overview")).toHaveTextContent("dono@awa.com");
    expect(screen.getByTestId("overview")).toHaveAttribute("data-readonly", "true");
    expect(screen.getByTestId("notice")).toHaveAttribute("data-mode", "owner");
  });

  it("Ver como membro: perfil do membro, e não do dono", async () => {
    viewingMember = { ...membro, role: "MEMBER", masterId: "dono", isOwner: false, permissions: {}, createdAt: null };
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByTestId("header-email")).toHaveTextContent("vendedora@awa.com"));
    expect(screen.getByTestId("overview")).toHaveTextContent("vendedora@awa.com");
    expect(screen.queryByText("dono@awa.com")).not.toBeInTheDocument();
    expect(screen.getByTestId("notice")).toHaveAttribute("data-mode", "member");
    expect(screen.getByTestId("notice")).toHaveTextContent("Vendedora");
  });
});
