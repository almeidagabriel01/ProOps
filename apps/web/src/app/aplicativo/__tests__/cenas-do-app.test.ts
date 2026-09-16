import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { BEATS, janelasDoBeat } from "../_components/aplicativo-conversa";

const RAIZ_WEB = path.resolve(__dirname, "../../../..");

describe("a marca dentro das réplicas", () => {
  /**
   * `MarcaApp` desenha a logo inline para herdar a cor e escalar em `cqw`. Ela
   * já foi uma espiral aproximada, que lia como outra marca. Este teste prende o
   * traçado ao arquivo oficial: trocar a logo sem trocar a cópia falha aqui.
   */
  it("usa o mesmo traçado de public/logo/logo2-cropped.svg", () => {
    const svg = readFileSync(
      path.join(RAIZ_WEB, "public/logo/logo2-cropped.svg"),
      "utf8",
    );
    const pecas = readFileSync(
      path.join(RAIZ_WEB, "src/app/aplicativo/_components/telas/pecas.tsx"),
      "utf8",
    );

    const tracado = (fonte: string) =>
      fonte.match(/ d="(M7500[^"]+)"/)?.[1].replace(/\s+/g, " ").trim();

    expect(tracado(svg)).toBeTruthy();
    expect(tracado(pecas)).toBe(tracado(svg));
    expect(pecas).toContain('viewBox="540 250 410 430"');
  });
});

describe("a tab bar das réplicas", () => {
  /**
   * A barra é a própria captura recortada (`scripts/generate-app-tabbars.mjs`).
   * Uma réplica que peça uma aba ativa sem imagem gerada renderiza um buraco no
   * rodapé do aparelho, sem erro nenhum.
   */
  it("toda aba ativa usada numa réplica tem a sua imagem", () => {
    const telas = ["tela-hoje", "tela-financeiro", "tela-conversa"].map((n) =>
      readFileSync(
        path.join(RAIZ_WEB, `src/app/aplicativo/_components/telas/${n}.tsx`),
        "utf8",
      ),
    );
    const ativas = telas.flatMap((fonte) =>
      [...fonte.matchAll(/<TabBar ativa="([a-z]+)"/g)].map((m) => m[1]),
    );
    expect(ativas.sort()).toEqual(["agente", "financeiro", "hoje"]);
    for (const aba of ativas) {
      expect(
        existsSync(path.join(RAIZ_WEB, `public/mockup-ios/tabbar-${aba}.png`)),
        aba,
      ).toBe(true);
    }
  });
});

describe("o revezamento dos beats de 'Sem sair da conversa'", () => {
  const ems = BEATS.map((b) => b.em);

  it("cada beat termina de sair antes de o seguinte terminar de chegar", () => {
    for (let i = 0; i < ems.length - 1; i += 1) {
      const atual = janelasDoBeat(ems, i);
      const seguinte = janelasDoBeat(ems, i + 1);
      expect(atual.sai[1]).toBeLessThan(seguinte.entra[1]);
    }
  });

  it("nenhum beat sai antes de ter chegado", () => {
    ems.forEach((_, i) => {
      const { entra, sai } = janelasDoBeat(ems, i);
      expect(entra[0]).toBeLessThan(entra[1]);
      expect(entra[1]).toBeLessThan(sai[0]);
      expect(sai[0]).toBeLessThan(sai[1]);
    });
  });

  it("o último beat fica na tela até o fim da cena", () => {
    const { sai } = janelasDoBeat(ems, ems.length - 1);
    expect(sai[0]).toBeGreaterThan(1);
  });
});
