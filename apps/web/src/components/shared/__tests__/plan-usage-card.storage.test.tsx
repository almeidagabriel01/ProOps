// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/usePlanUsage", () => ({ usePlanUsage: () => ({}) }));

import { PlanUsageCard } from "@/components/shared/plan-usage-card";
import type { UsePlanUsageReturn } from "@/hooks/usePlanUsage";

const item = (label: string, current: number, limit: number, unit?: string) => ({
  label,
  current,
  limit,
  percentage: limit > 0 ? Math.round((current / limit) * 100) : 0,
  isUnlimited: limit === -1,
  unit,
});

function data(storageLimit: number): UsePlanUsageReturn {
  return {
    proposals: item("Propostas", 1, 80),
    clients: item("Clientes", 1, 120),
    products: item("Produtos", 1, 220),
    users: item("Membros", 1, 1),
    storage: item("Armazenamento", 2.1, storageLimit, "MB"),
    isLoading: false,
    overallPercentage: 1,
    criticalItems: [],
  };
}

describe("armazenamento no card de uso do plano", () => {
  it("mostra o uso contra o teto, em MB e com vírgula", () => {
    render(<PlanUsageCard variant="profile" data={data(200)} />);
    expect(screen.getByText("Armazenamento")).toBeTruthy();
    expect(screen.getByText("2,1 / 200 MB")).toBeTruthy();
  });

  it("no plano ilimitado mostra quanto já foi usado, não só o infinito", () => {
    render(<PlanUsageCard variant="profile" data={data(-1)} />);
    expect(screen.getByText(/2,1 MB usados/)).toBeTruthy();
  });
});
