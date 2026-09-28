/**
 * As larguras menores de cada print, geradas do arquivo base. As páginas servem
 * os prints como arquivo estático com `srcset` próprio (`lib/landing/capturas.ts`),
 * sem passar pelo otimizador do Next: no 16.3.4 um pedido abandonado no meio,
 * com outro igual esperando junto, deixa aquela imagem pendurada para sempre no
 * `next dev` e no `next start`.
 *
 *   npx tsx tests/capturas-do-erp/variantes.ts     # refaz as variantes de todos os prints
 */
import * as path from "path";
import sharp from "sharp";

import {
  CAPTURAS_DAS_FUNCIONALIDADES,
  CAPTURAS_DOS_NICHOS,
  LARGURAS_DAS_CAPTURAS,
  srcDaCaptura,
  type Captura,
} from "../../apps/web/src/lib/landing/capturas";

const PUBLIC = path.resolve(__dirname, "../../apps/web/public");

export async function gerarVariantes(captura: Captura): Promise<void> {
  const base = path.join(PUBLIC, captura.src);
  for (const largura of LARGURAS_DAS_CAPTURAS[captura.formato]) {
    if (largura === captura.largura) continue;
    await sharp(base)
      .resize({ width: largura })
      .webp({ quality: 80 })
      .toFile(path.join(PUBLIC, srcDaCaptura(captura, largura)));
  }
}

export const TODAS_AS_CAPTURAS: Captura[] = [
  ...Object.values(CAPTURAS_DAS_FUNCIONALIDADES),
  ...Object.values(CAPTURAS_DOS_NICHOS).flatMap((c) => Object.values(c)),
];

if (require.main === module) {
  (async () => {
    for (const captura of TODAS_AS_CAPTURAS) await gerarVariantes(captura);
    console.log(`[capturas] Variantes de ${TODAS_AS_CAPTURAS.length} prints geradas.`);
  })();
}
