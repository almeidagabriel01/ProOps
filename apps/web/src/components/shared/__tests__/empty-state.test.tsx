// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("mostra título, descrição e ação", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nada aqui"
        description="Crie o primeiro item."
        action={<button>Criar</button>}
      />,
    );
    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
    expect(screen.getByText("Crie o primeiro item.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeInTheDocument();
  });

  it("sem ação não desenha botão", () => {
    render(<EmptyState icon={Inbox} title="Nada aqui" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
