// @vitest-environment jsdom
/**
 * Peças e serviços da OS: o catálogo inteiro aparece (antes a busca mostrava
 * só oito), o item repetido soma quantidade em vez de duplicar a linha, e a
 * quantidade aceita fração digitada e mostra inteiro sem casas.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ServiceOrderItem } from "@/types/field-service";

const products = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i}`,
  name: `Produto ${String(i).padStart(2, "0")}`,
  price: "100",
  markup: "10",
  category: "Peças",
  manufacturer: "Frioteck",
  inventoryValue: 5,
  images: [],
}));

vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/hooks/useCurrentNicheConfig", () => ({
  useCurrentNicheConfig: () => ({
    productCatalog: { inventory: { mode: "unit", unitSuffix: "un", unitLabel: "Unidades" } },
  }),
}));
vi.mock("@/services/product-service", () => ({ ProductService: { getProducts: async () => products } }));
vi.mock("@/services/service-service", () => ({
  ServiceService: { getServices: async () => [{ id: "s1", name: "Visita técnica", price: "150", category: "Visita", images: [] }] },
}));

import { ItemsEditor } from "../items-editor";

function Harness({ initial = [] as ServiceOrderItem[] }) {
  const [items, setItems] = React.useState<ServiceOrderItem[]>(initial);
  return (
    <>
      <ItemsEditor items={items} onChange={setItems} />
      <output data-testid="state">{JSON.stringify(items.map((i) => [i.refId, i.quantity]))}</output>
    </>
  );
}

describe("peças e serviços da OS", () => {
  it("o catálogo mostra todos os itens, produtos e serviços", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Adicionar do catálogo/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Produto 11/ })).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /Produto \d\d/ })).toHaveLength(12);
    expect(screen.getByRole("button", { name: /Visita técnica/ })).toBeInTheDocument();
  });

  it("escolher com quantidade e confirmar; o repetido soma na mesma linha", async () => {
    render(<Harness />);
    for (let round = 0; round < 2; round++) {
      await userEvent.click(screen.getByRole("button", { name: /Adicionar do catálogo/ }));
      const card = await screen.findByRole("button", { name: /Produto 03/ });
      await userEvent.click(card);
      await userEvent.click(screen.getByRole("button", { name: "Mais Produto 03" }));
      await userEvent.click(screen.getByRole("button", { name: /Adicionar 1 item/ }));
    }
    expect(screen.getByTestId("state").textContent).toBe(JSON.stringify([["p3", 4]]));
  });

  it("quantidade aceita fração com vírgula e mostra inteiro sem casas", async () => {
    render(
      <Harness
        initial={[{ id: "a", kind: "product", refId: "p1", name: "Cabo", quantity: 1, unitPrice: 12, fromStock: true }]}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Quantidade de Cabo" });
    expect(input).toHaveValue("1");
    await userEvent.clear(input);
    await userEvent.type(input, "2,5");
    fireEvent.blur(input);
    expect(screen.getByTestId("state").textContent).toBe(JSON.stringify([["p1", 2.5]]));
    expect(screen.getAllByText("R$ 30,00", { exact: false }).length).toBeGreaterThan(0);
  });
});
