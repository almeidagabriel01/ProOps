// @vitest-environment jsdom
/**
 * O link de compartilhamento não tem onde quebrar. Sem uma coluna que possa
 * encolher, ele esticava o grid do diálogo para fora da caixa (o "Enviar
 * proposta" aparecia com o conteúdo vazando à direita). O jsdom não mede
 * layout, então o teste trava as classes que fazem o conteúdo caber.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SendLinkPanel } from "@/components/shared/send-link-panel";

const LONG_URL = `https://exemplo.vercel.app/share/${"a".repeat(120)}`;

describe("largura do diálogo de envio", () => {
  it("o DialogContent usa uma coluna que pode encolher", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Enviar proposta</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("grid-cols-[minmax(0,1fr)]");
  });

  it("uma classe do chamador não derruba a coluna", () => {
    render(
      <Dialog open>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Enviar proposta</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("grid-cols-[minmax(0,1fr)]", "sm:max-w-lg");
  });

  it("o painel e a linha do link podem encolher, e o link é cortado", () => {
    render(<SendLinkPanel url={LONG_URL} subject="s" defaultMessage="m" />);
    const link = screen.getByText(LONG_URL);
    expect(link).toHaveClass("min-w-0", "truncate");
    expect(link.parentElement).toHaveClass("min-w-0");
    expect(link.parentElement?.parentElement).toHaveClass("min-w-0");
    expect(screen.getByRole("button", { name: /Copiar/ })).toHaveClass("shrink-0");
  });
});
