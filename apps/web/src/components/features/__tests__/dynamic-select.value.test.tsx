// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({ getOptions: vi.fn() }));

vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/option-service", () => ({
  OptionService: {
    getOptions: (...a: unknown[]) => m.getOptions(...a),
    createOption: vi.fn(),
  },
}));
vi.mock("@/components/features/option-manager-dialog", () => ({ OptionManagerDialog: () => null }));

import { DynamicSelect } from "../dynamic-select";

function optionTexts() {
  return Array.from(document.querySelectorAll("select option")).map((o) => o.textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getOptions.mockResolvedValue([{ id: "o1", tenantId: "t1", type: "product_categories", label: "Sensores" }]);
});

describe("DynamicSelect com valor gravado", () => {
  it("mostra a categoria gravada mesmo fora da lista (ex.: veio de uma importação)", async () => {
    render(
      <DynamicSelect storageKey="product_categories" label="Categoria" name="category" value="Mão de obra" onChange={vi.fn()} />,
    );
    await waitFor(() => expect(optionTexts()).toContain("Sensores"));
    expect(optionTexts()).toContain("Mão de obra");
    expect(screen.getByRole("textbox")).toHaveValue("Mão de obra");
  });

  it("valor que já está na lista não aparece duas vezes", async () => {
    render(<DynamicSelect storageKey="product_categories" label="Categoria" name="category" value="Sensores" onChange={vi.fn()} />);
    await waitFor(() => expect(optionTexts()).toContain("Sensores"));
    expect(optionTexts().filter((t) => t === "Sensores")).toHaveLength(1);
  });

  it("sem valor, só a lista", async () => {
    render(<DynamicSelect storageKey="product_categories" label="Categoria" name="category" value="" onChange={vi.fn()} />);
    await waitFor(() => expect(optionTexts()).toContain("Sensores"));
    expect(optionTexts()).toHaveLength(2); // "Selecione..." + Sensores
  });
});
