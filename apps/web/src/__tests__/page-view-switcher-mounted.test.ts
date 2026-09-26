import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { menuItems } from "@/components/layout/navigation-config";

/**
 * A dock desenha um ícone por grupo, então o seletor de cabeçalho é o ÚNICO
 * caminho entre as telas irmãs de um grupo. Uma tela que esqueça de montá-lo
 * vira um beco: dá para entrar nela e não dá para voltar para as irmãs sem o
 * command palette ou a URL na mão.
 *
 * Nada quebra e nada avisa: é um componente que falta num JSX, invisível para o
 * TypeScript. Guard de varredura de texto, como o de paridade do StepWizard.
 */

const RAIZ = path.resolve(__dirname, "..");

/** Rotas que não renderizam a própria página. */
const ARQUIVO_DA_ROTA: Record<string, string> = {
  // /solutions e /ambientes delegam para AutomationPage, que tem dois
  // cabeçalhos: o modo só-ambientes e o padrão.
  "/solutions": "app/automation/page.tsx",
};

function arquivoDaRota(href: string): string {
  return ARQUIVO_DA_ROTA[href] ?? `app${href}/page.tsx`;
}

describe("PageViewSwitcher está montado em toda tela de grupo", () => {
  const telasDeGrupo = menuItems
    .filter((item) => item.children && item.children.length > 1)
    .flatMap((item) => item.children!)
    .map((child) => child.href);

  it("existe pelo menos um grupo com mais de uma tela", () => {
    expect(telasDeGrupo.length).toBeGreaterThan(1);
  });

  it.each(telasDeGrupo)("%s monta o seletor", (href) => {
    const arquivo = path.join(RAIZ, arquivoDaRota(href));
    expect(fs.existsSync(arquivo), `${arquivo} não existe`).toBe(true);

    const fonte = fs.readFileSync(arquivo, "utf-8");
    expect(
      fonte.includes("<PageViewSwitcher"),
      `${href} não monta <PageViewSwitcher>: as telas irmãs ficam inalcançáveis`,
    ).toBe(true);
  });
});
