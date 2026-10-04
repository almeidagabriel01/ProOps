// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TenantBillingInfo } from "@/services/admin-service";

const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/storage-service", () => ({ ALLOWED_TYPES: [] }));
vi.mock("@/lib/image-downscale", () => ({ downscaleLogo: vi.fn() }));

import { TenantDialog } from "../tenant-dialog";

function tenant(overrides: Partial<TenantBillingInfo> = {}, periodEnd = "2099-09-14"): TenantBillingInfo {
  return {
    tenant: { id: "t1", name: "Maison", createdAt: "2026-01-01" },
    admin: { id: "u1", name: "Dono", email: "dono@maison.test", currentPeriodEnd: periodEnd },
    planName: "Enterprise",
    planId: "enterprise",
    subscriptionStatus: "active",
    billingManagedBy: "manual",
    usage: { users: 1, proposals: 0, clients: 0, products: 0, transactions: 0, wallets: 0, calendarEvents: 0 },
    ...overrides,
  } as TenantBillingInfo;
}

async function openSubscriptionTab() {
  const trigger = screen.getByRole("tab", { name: /Assinatura/i });
  fireEvent.mouseDown(trigger, { button: 0 });
  fireEvent.click(trigger);
  await screen.findByLabelText("Plano");
}

beforeEach(() => vi.clearAllMocks());

describe("TenantDialog: contrato manual", () => {
  it("encerrar o acesso agora pede confirmação e chama o painel", async () => {
    const onEndManualAccess = vi.fn().mockResolvedValue(undefined);
    render(
      <TenantDialog isOpen onClose={vi.fn()} onSave={vi.fn()} initialData={tenant()} onEndManualAccess={onEndManualAccess} />,
    );
    await openSubscriptionTab();

    fireEvent.click(screen.getByRole("button", { name: "Encerrar acesso agora" }));
    expect(await screen.findByText("Encerrar o acesso agora?")).toBeInTheDocument();
    expect(onEndManualAccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Encerrar acesso" }));
    await waitFor(() => expect(onEndManualAccess).toHaveBeenCalledTimes(1));
  });

  it("empresa do Stripe não tem o botão", async () => {
    render(
      <TenantDialog
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialData={tenant({ billingManagedBy: "stripe" })}
        onEndManualAccess={vi.fn()}
      />,
    );
    await openSubscriptionTab();
    expect(screen.queryByRole("button", { name: "Encerrar acesso agora" })).not.toBeInTheDocument();
  });

  it("empresa já cancelada ou no plano gratuito não tem o botão", async () => {
    const { unmount } = render(
      <TenantDialog
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialData={tenant({ subscriptionStatus: "canceled" })}
        onEndManualAccess={vi.fn()}
      />,
    );
    await openSubscriptionTab();
    expect(screen.queryByRole("button", { name: "Encerrar acesso agora" })).not.toBeInTheDocument();
    unmount();

    render(
      <TenantDialog
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialData={tenant({ planId: "free" })}
        onEndManualAccess={vi.fn()}
      />,
    );
    await openSubscriptionTab();
    expect(screen.queryByRole("button", { name: "Encerrar acesso agora" })).not.toBeInTheDocument();
  });

  it("plano pago sem vencimento não salva (sem data não há aviso nem corte)", async () => {
    const onSave = vi.fn();
    render(<TenantDialog isOpen onClose={vi.fn()} onSave={onSave} initialData={tenant({}, "")} />);

    fireEvent.change(screen.getByLabelText("Nome da Empresa"), { target: { value: "Maison 2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar Alterações" }).closest("form")!);

    expect(onSave).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Informe o vencimento do plano pago, na aba Assinatura.");
  });

  it("com vencimento o plano pago salva", async () => {
    const onSave = vi.fn();
    render(<TenantDialog isOpen onClose={vi.fn()} onSave={onSave} initialData={tenant()} />);

    fireEvent.change(screen.getByLabelText("Nome da Empresa"), { target: { value: "Maison 2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar Alterações" }).closest("form")!);

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
