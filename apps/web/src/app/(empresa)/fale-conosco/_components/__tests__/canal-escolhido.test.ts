import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { escolheCanal, useCanalEscolhido } from "../canal-escolhido";

function Leitor() {
  return createElement("span", null, useCanalEscolhido() ?? "nenhum");
}

describe("canal escolhido em /fale-conosco", () => {
  it("no servidor ninguém escolheu nada, qualquer que seja o estado do módulo", () => {
    escolheCanal("Suporte");
    expect(renderToString(createElement(Leitor))).toContain("nenhum");
    escolheCanal(null);
  });
});
