import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  CAPTURAS_DAS_FUNCIONALIDADES,
  CAPTURAS_DOS_NICHOS,
  LARGURAS_DAS_CAPTURAS,
  srcDaCaptura,
  srcSetDaCaptura,
  type Captura,
} from "../capturas";

const PUBLIC = path.resolve(__dirname, "../../../../public");

const todas: [string, Captura][] = [
  ...Object.entries(CAPTURAS_DAS_FUNCIONALIDADES),
  ...Object.entries(CAPTURAS_DOS_NICHOS).flatMap(([nicho, c]) =>
    Object.entries(c).map(([tela, captura]) => [`${nicho}/${tela}`, captura] as [string, Captura]),
  ),
];

/**
 * Um print referenciado que não existe vira um quadro vazio na página, sem
 * erro nenhum no build. E as dimensões declaradas precisam ser as do arquivo,
 * senão o `next/image` reserva o espaço errado e a página salta ao carregar.
 */
describe("capturas do ERP", () => {
  it.each(todas)("%s existe e tem as dimensões declaradas", async (_nome, captura) => {
    const arquivo = path.join(PUBLIC, captura.src);
    expect(existsSync(arquivo), captura.src).toBe(true);
    const { width, height } = await sharp(arquivo).metadata();
    expect([width, height]).toEqual([captura.largura, captura.altura]);
  });

  // As páginas servem as larguras menores direto do `public/`, pelo `srcset`:
  // uma variante que falte é um 404 que o navegador escolhe em silêncio.
  it.each(todas)("%s tem todas as larguras do srcset", async (_nome, captura) => {
    for (const largura of LARGURAS_DAS_CAPTURAS[captura.formato]) {
      const arquivo = path.join(PUBLIC, srcDaCaptura(captura, largura));
      expect(existsSync(arquivo), arquivo).toBe(true);
      expect((await sharp(arquivo).metadata()).width).toBe(largura);
    }
    expect(srcSetDaCaptura(captura).split(", ")).toHaveLength(LARGURAS_DAS_CAPTURAS[captura.formato].length);
  });

  it("a maior largura de cada formato é a do arquivo base", () => {
    for (const [, captura] of todas) {
      expect(Math.max(...LARGURAS_DAS_CAPTURAS[captura.formato])).toBe(captura.largura);
    }
  });

  it("todo texto alternativo diz o que a tela mostra", () => {
    for (const [nome, captura] of todas) expect(captura.alt.length, nome).toBeGreaterThan(30);
  });
});
