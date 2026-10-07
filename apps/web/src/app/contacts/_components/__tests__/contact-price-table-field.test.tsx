// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  plan: { hasPriceTables: true },
  options: [
    { id: "vip", name: "VIP", adjustmentPercent: -10 },
    { id: "obra", name: "Construtoras", adjustmentPercent: 5 },
  ],
  optionsEnabled: [] as boolean[],
}));

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => true,
  usePageScope: () => ({ scope: "all", isLoading: false }),
  useSensitiveData: () => ({
    isLoading: false,
    canSeeCost: true,
    canSeeStock: true,
    canSeeContractValues: true,
    canSeeServiceOrderPrices: true,
    canSeeCommissions: true,
    canSeeBalance: true,
  }),
}));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/hooks/use-price-tables", () => ({
  usePriceTableOptions: (enabled: boolean) => {
    m.optionsEnabled.push(enabled);
    return { options: enabled ? m.options : [], isLoading: false };
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  ContactPriceTableField,
  priceTableIdForSave,
  showsPriceTableField,
} from "../contact-price-table-field";

beforeEach(() => {
  m.plan = { hasPriceTables: true };
  m.optionsEnabled = [];
});

describe("Tabela de preço do cliente", () => {
  it("padrão é a tabela padrão (o catálogo), e escolher manda o id", async () => {
    const onChange = vi.fn();
    render(<ContactPriceTableField types={["cliente"]} value={null} onChange={onChange} />);
    const select = screen.getByLabelText("Tabela de preço");
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "Tabela padrão (catálogo)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "VIP: 10% de desconto" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Construtoras: 5% de acréscimo" })).toBeInTheDocument();

    await userEvent.selectOptions(select, "vip");
    expect(onChange).toHaveBeenCalledWith("vip");
  });

  it("voltar para a padrão manda null", async () => {
    const onChange = vi.fn();
    render(<ContactPriceTableField types={["cliente"]} value="vip" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Tabela de preço"), "");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("leva para a aba de tabelas em Produtos", () => {
    render(<ContactPriceTableField types={["cliente"]} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Ver as tabelas" })).toHaveAttribute(
      "href",
      "/products?aba=tabelas-de-preco",
    );
  });

  it("fornecedor e parceiro não têm tabela, e nem buscam as opções", () => {
    for (const types of [["fornecedor"], ["vendedor"], ["arquiteto"]] as const) {
      const { container, unmount } = render(
        <ContactPriceTableField types={[...types]} value={null} onChange={vi.fn()} />,
      );
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    expect(m.optionsEnabled.every((enabled) => enabled === false)).toBe(true);
  });

  it("sem o módulo no plano (Starter) o campo não aparece", () => {
    m.plan = { hasPriceTables: false };
    const { container } = render(
      <ContactPriceTableField types={["cliente"]} value={null} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("somente leitura mostra o nome da tabela, ou a padrão", () => {
    const { rerender } = render(
      <ContactPriceTableField types={["cliente"]} value="obra" onChange={vi.fn()} readOnly />,
    );
    expect(screen.getByText("Construtoras: 5% de acréscimo")).toBeInTheDocument();
    rerender(<ContactPriceTableField types={["cliente"]} value={null} onChange={vi.fn()} readOnly />);
    expect(screen.getByText("Tabela padrão (catálogo)")).toBeInTheDocument();
  });
});

describe("regras puras", () => {
  it("o campo aparece só para cliente e com o módulo", () => {
    expect(showsPriceTableField(["cliente"], true)).toBe(true);
    expect(showsPriceTableField(["cliente", "fornecedor"], true)).toBe(true);
    expect(showsPriceTableField(["fornecedor"], true)).toBe(false);
    expect(showsPriceTableField(["cliente"], false)).toBe(false);
  });

  it("deixar de ser cliente salva a tabela padrão", () => {
    expect(priceTableIdForSave(["cliente"], "vip")).toBe("vip");
    expect(priceTableIdForSave(["fornecedor"], "vip")).toBeNull();
    expect(priceTableIdForSave(["cliente"], null)).toBeNull();
  });
});
