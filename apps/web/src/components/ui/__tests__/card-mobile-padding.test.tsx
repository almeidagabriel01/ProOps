// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * CardContent aplica `max-sm:px-4 max-sm:pb-4`. Por serem media queries, essas
 * regras VENCEM um `p-0` sem prefixo vindo do call site — e o twMerge também
 * não as remove, porque modificadores diferentes não conflitam.
 *
 * Foi assim que a lista de lançamentos ganhou faixas brancas nas laterais no
 * celular (o `<CardContent className="p-0">` continuava com 16px de cada lado)
 * e o card agrupado ficou com recuo duplo sobre o px da própria linha.
 *
 * Um call site que precisa de conteúdo sangrado até a borda tem que pedir
 * `p-0 max-sm:p-0`.
 */
describe("CardContent — padding mobile", () => {
  const classesOf = (ui: React.ReactElement) => {
    const { container } = render(ui);
    return (
      container.querySelector("[data-testid='content']")?.className ?? ""
    ).split(/\s+/);
  };

  it("mantém o padding mobile por padrão", () => {
    const classes = classesOf(
      <Card>
        <CardContent data-testid="content">x</CardContent>
      </Card>,
    );

    expect(classes).toContain("max-sm:px-4");
    expect(classes).toContain("max-sm:pb-4");
  });

  it("p-0 sozinho NÃO zera o padding mobile — este é o bug", () => {
    const classes = classesOf(
      <Card>
        <CardContent data-testid="content" className="p-0">
          x
        </CardContent>
      </Card>,
    );

    expect(classes).toContain("p-0");
    expect(classes).toContain("max-sm:px-4");
  });

  it("p-0 max-sm:p-0 sangra o conteúdo até a borda no celular", () => {
    const classes = classesOf(
      <Card>
        <CardContent data-testid="content" className="p-0 max-sm:p-0">
          x
        </CardContent>
      </Card>,
    );

    expect(classes).toContain("max-sm:p-0");
    expect(classes).not.toContain("max-sm:px-4");
    expect(classes).not.toContain("max-sm:pb-4");
  });
});
