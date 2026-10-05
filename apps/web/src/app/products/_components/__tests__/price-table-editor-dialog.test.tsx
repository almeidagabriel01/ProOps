// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Editor da tabela de preço. Pedidos depois do primeiro teste do cliente
 * (2026-10-05): o preço próprio se escolhe no MESMO catálogo do Novo Contrato
 * (cartões com busca e filtro, à vista sem digitar), e o campo do percentual
 * tem a mesma altura dos botões Desconto/Acréscimo ao lado.
 */

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1", niche: "automacao_residencial" } }),
}));
vi.mock("@/hooks/useCurrentNicheConfig", async () => {
  const { getNicheConfig } = await import("@/lib/niches/config");
  return { useCurrentNicheConfig: () => getNicheConfig("automacao_residencial") };
});
vi.mock("@/services/product-service", () => ({
  ProductService: {
    getProducts: vi.fn(async () => [
      { id: "p2", name: "Caixa Acústica", price: "200", markup: "50", manufacturer: "" },
      { id: "p1", name: "Amplificador", price: "100", markup: "50", manufacturer: "" },
      {
        id: "p3",
        name: "Persiana Rolô",
        price: "0",
        manufacturer: "",
        pricingModel: {
          mode: "curtain_height",
          tiers: [{ id: "t1", maxHeight: 2.5, basePrice: 100, markup: 50 }],
        },
      },
    ]),
  },
}));
vi.mock("@/services/service-service", () => ({
  ServiceService: {
    getServices: vi.fn(async () => [{ id: "s1", name: "Instalação", price: "500" }]),
  },
}));

import { PriceTableEditorDialog } from "../price-table-editor-dialog";

function renderDialog() {
  return render(
    <PriceTableEditorDialog
      open
      onOpenChange={() => undefined}
      table={null}
      readOnly={false}
      onSave={async () => undefined}
    />,
  );
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  // Enquanto o catálogo carrega o botão leva o spinner (que tem rótulo
  // próprio) e fica desabilitado.
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Adicionar do catálogo" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Adicionar do catálogo" }));
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Preço próprio" })).toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("button", { name: /^Amplificador/ })).toBeInTheDocument());
}

describe("PriceTableEditorDialog", () => {
  it("abre o catálogo do Novo Contrato, com tudo à vista sem digitar", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openPicker(user);
    for (const name of [/^Amplificador/, /^Caixa Acústica/, /^Instalação/, /^Persiana Rolô/]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("escolhe vários itens de uma vez, e eles saem do catálogo na próxima vez", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openPicker(user);

    await user.click(screen.getByRole("button", { name: /^Amplificador/ }));
    await user.click(screen.getByRole("button", { name: /^Instalação/ }));
    await user.click(screen.getByRole("button", { name: "Adicionar 2 itens" }));

    expect(screen.getByLabelText("Preço próprio de Amplificador")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço próprio de Instalação")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Adicionar do catálogo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Caixa Acústica/ })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^Amplificador/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Instalação/ })).not.toBeInTheDocument();
  });

  it("tocar de novo desmarca o item", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openPicker(user);
    const card = screen.getByRole("button", { name: /^Amplificador/ });
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "false");
  });

  it("produto por faixa de altura aparece desabilitado: vale só o ajuste", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openPicker(user);
    const card = screen.getByRole("button", { name: /^Persiana Rolô/ });
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Por faixa de altura: vale só o ajuste")).toBeInTheDocument();
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "false");
  });

  it("percentual e botões de ajuste têm a mesma altura", () => {
    renderDialog();
    expect(screen.getByLabelText("Percentual")).toHaveClass("h-12");
    expect(screen.getByRole("button", { name: "Desconto" })).toHaveClass("h-12");
    expect(screen.getByRole("button", { name: "Acréscimo" })).toHaveClass("h-12");
  });
});
