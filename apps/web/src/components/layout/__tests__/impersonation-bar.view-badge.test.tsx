// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImpersonationBar } from "../impersonation-bar";

/**
 * O super admin não conseguia saber se estava no painel do dono ou no de um
 * membro. O selo diz isso em qualquer largura de tela.
 */

function renderBar(props: Partial<React.ComponentProps<typeof ImpersonationBar>> = {}) {
  render(
    <ImpersonationBar
      companyName="AWA"
      writeEnabled={false}
      onToggleWrite={vi.fn()}
      onExit={vi.fn()}
      {...props}
    />,
  );
}

describe("ImpersonationBar: de quem é o painel", () => {
  it("Acessar Painel mostra o selo Dono e o nome do dono", () => {
    renderBar({ ownerName: "Dono AWA" });
    expect(screen.getByTestId("impersonation-view-badge")).toHaveTextContent("Dono");
    expect(screen.getByTestId("impersonation-bar")).toHaveAttribute("data-mode", "read");
    expect(screen.getByText(/painel de Dono AWA/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Habilitar edição" })).toBeInTheDocument();
  });

  it("Ver como membro mostra o selo Membro, o nome dele e nenhuma edição", () => {
    renderBar({ memberName: "Vendedora", ownerName: "Dono AWA" });
    expect(screen.getByTestId("impersonation-view-badge")).toHaveTextContent("Membro");
    expect(screen.getByTestId("impersonation-bar")).toHaveAttribute("data-mode", "member");
    expect(screen.getByText("Vendedora")).toBeInTheDocument();
    expect(screen.queryByText(/painel de Dono AWA/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Habilitar edição" })).not.toBeInTheDocument();
  });

  it("modo membro diz somente leitura mesmo com a edição da empresa ligada", () => {
    renderBar({ memberName: "Vendedora", writeEnabled: true });
    expect(screen.getByText("Somente leitura")).toBeInTheDocument();
    expect(screen.queryByText("Edição habilitada")).not.toBeInTheDocument();
  });
});
