// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Regression: the "Acessar Painel" button was enabled for free-tier tenants,
 * letting the superadmin enter the ERP of an account that has no ERP access.
 * The button must render disabled for free tenants and never fire onLoginAs.
 */

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/services/admin-service", () => ({
  AdminService: { resetMemberMfa: vi.fn() },
}));

import { TenantCard } from "../tenant-card";
import type { TenantBillingInfo } from "@/services/admin-service";

function billingInfo(overrides: {
  planId?: string;
  planName: string;
  subscriptionStatus?: string;
}): TenantBillingInfo {
  return {
    tenant: { id: "t1", name: "Empresa Teste", createdAt: "2026-03-18" },
    admin: { id: "u1", email: "a@b.com" },
    planName: overrides.planName,
    planId: overrides.planId,
    subscriptionStatus: overrides.subscriptionStatus,
    billingInterval: "monthly",
    usage: {
      users: 0,
      proposals: 0,
      clients: 0,
      products: 0,
      transactions: 0,
      wallets: 0,
      calendarEvents: 0,
    },
  } as TenantBillingInfo;
}

const onLoginAs = vi.fn();
const noopAsync = vi.fn().mockResolvedValue(undefined);

function renderCard(item: TenantBillingInfo) {
  return render(
    <TenantCard
      item={item}
      onEdit={vi.fn()}
      onDelete={noopAsync}
      onLoginAs={onLoginAs}
    />,
  );
}

beforeEach(() => {
  onLoginAs.mockClear();
});

describe("TenantCard — Acessar Painel button", () => {
  it("disables the button for a free-plan tenant and does not fire onLoginAs", () => {
    renderCard(
      billingInfo({ planId: "free", planName: "Gratuito", subscriptionStatus: "free" }),
    );

    const button = screen.getByRole("button", { name: /acessar painel/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onLoginAs).not.toHaveBeenCalled();
  });

  it("disables the button when planId is missing but the plan label is free", () => {
    renderCard(billingInfo({ planName: "Gratuito", subscriptionStatus: "free" }));

    expect(
      screen.getByRole("button", { name: /acessar painel/i }),
    ).toBeDisabled();
  });

  it("enables the button for a paid tenant and fires onLoginAs with the billing item", () => {
    const item = billingInfo({
      planId: "pro",
      planName: "Pro",
      subscriptionStatus: "active",
    });
    renderCard(item);

    const button = screen.getByRole("button", { name: /acessar painel/i });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onLoginAs).toHaveBeenCalledTimes(1);
    expect(onLoginAs).toHaveBeenCalledWith(item);
  });

  it("keeps the button disabled for a tenant downgraded to free after cancellation", () => {
    renderCard(
      billingInfo({ planId: "free", planName: "Pro", subscriptionStatus: "canceled" }),
    );

    expect(
      screen.getByRole("button", { name: /acessar painel/i }),
    ).toBeDisabled();
  });
});
