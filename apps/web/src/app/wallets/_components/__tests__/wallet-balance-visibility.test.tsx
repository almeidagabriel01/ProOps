// @vitest-environment jsdom
/**
 * "Ver saldo" (wallet.viewBalance): quem não tem a chave usa as carteiras
 * (nome, tipo, ações) sem ver quanto há em cada uma, nem no total.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Wallet } from "@/types";

const m = vi.hoisted(() => ({ canSeeBalance: true }));

vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ isReadOnly: false }) }));
vi.mock("@/hooks/usePermission", () => ({
  useSensitiveData: () => ({ isLoading: false, canSeeBalance: m.canSeeBalance }),
}));

import { WalletCard } from "../wallet-card";
import { WalletsSummaryCards } from "../wallets-summary-cards";

const WALLET = {
  id: "w1",
  tenantId: "t1",
  name: "Caixa da loja",
  type: "cash",
  balance: 12345.67,
  status: "active",
  isDefault: false,
} as unknown as Wallet;

const noop = () => undefined;

function renderAll() {
  render(
    <>
      <WalletCard
        wallet={WALLET}
        canEdit
        canDelete
        onEdit={noop}
        onDelete={noop}
        onTransfer={noop}
        onAdjust={noop}
        onArchive={noop}
        onSetDefault={noop}
        onViewHistory={noop}
      />
      <WalletsSummaryCards
        summary={{ totalBalance: 12345.67, activeWallets: 1 } as never}
        activeWallets={[WALLET]}
        onOpenTransfer={noop}
      />
    </>,
  );
}

beforeEach(() => {
  m.canSeeBalance = true;
});

describe("saldo das carteiras", () => {
  it("com 'Ver saldo', o card e o consolidado mostram o valor", () => {
    renderAll();
    expect(screen.getAllByText(/12\.345,67/).length).toBe(2);
  });

  it("sem 'Ver saldo', a carteira aparece sem valor nenhum", () => {
    m.canSeeBalance = false;
    renderAll();
    expect(screen.getByText("Caixa da loja")).toBeInTheDocument();
    expect(screen.queryByText(/12\.345,67/)).not.toBeInTheDocument();
  });
});
