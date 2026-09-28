import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Esqueleto de carregamento com largura fixa maior que o celular.
 *
 * `mobile/no-overflow.spec.ts` só pega o esqueleto se medir a rota no instante
 * em que ele está na tela, então o vazamento aparece como teste instável e some
 * no retry: foi assim que a barra `w-96` do cabeçalho de `/services` (384px,
 * mais o respiro da página) passou dos 393px do Pixel 5 no CI. Este guard olha
 * o código em vez do instante.
 *
 * Regra: em arquivo de esqueleto ou `loading.tsx`, uma largura SEM prefixo de
 * breakpoint acima de 320px (o piso de design é 360px, menos o respiro) precisa
 * vir com um `max-w-` na mesma classe.
 */
const SRC = path.resolve(__dirname, "..");
const LIMITE_PX = 320;

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === "__tests__" ? [] : arquivos(full);
    return /(skeleton[^/\\]*|^loading)\.tsx$/i.test(e.name) ? [full] : [];
  });
}

/** Largura em px de uma classe `w-*` sem prefixo, ou null. */
function larguraPx(classe: string): number | null {
  const escala = /^w-(\d+(?:\.5)?)$/.exec(classe);
  if (escala) return Number(escala[1]) * 4;
  const px = /^w-\[(\d+)px\]$/.exec(classe);
  if (px) return Number(px[1]);
  const rem = /^w-\[(\d+(?:\.\d+)?)rem\]$/.exec(classe);
  if (rem) return Number(rem[1]) * 16;
  return null;
}

function violacoes(arquivo: string): string[] {
  const texto = fs.readFileSync(arquivo, "utf8");
  const achados: string[] = [];
  for (const m of texto.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const classes = (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/);
    const larga = classes.find((c) => (larguraPx(c) ?? 0) > LIMITE_PX);
    if (larga && !classes.some((c) => c.startsWith("max-w-"))) {
      const linha = texto.slice(0, m.index).split("\n").length;
      achados.push(`${path.relative(SRC, arquivo)}:${linha} ${larga}`);
    }
  }
  return achados;
}

describe("esqueleto de carregamento cabe no celular", () => {
  const lista = arquivos(SRC);

  it("encontra os esqueletos (sanidade da varredura)", () => {
    expect(lista.length).toBeGreaterThan(10);
  });

  it("nenhuma largura fixa acima do celular sem max-w", () => {
    expect(lista.flatMap(violacoes)).toEqual([]);
  });
});
