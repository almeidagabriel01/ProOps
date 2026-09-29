import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O projeto tem um spinner próprio — `Loader` (`ui/loader.tsx`, o LumaSpin).
 * O `Loader2` do lucide-react tinha entrado em paralelo e se espalhado por 9
 * arquivos: telas vizinhas mostravam animações diferentes para a mesma espera,
 * e cada novo botão herdava a versão do arquivo ao lado, ao acaso.
 *
 * Não é só estética. O `Loader` traz `role="status"` e `aria-label`, então o
 * leitor de tela anuncia o carregamento; o ícone do lucide entrava como
 * decoração muda. E ele expõe as variantes que os call sites precisam —
 * `variant="button"` herda `currentColor`, o que mantém o spinner legível em
 * botão escuro sem ninguém repetir classe de cor.
 *
 * Este guard varre o código porque a inconsistência não aparece em teste de
 * rota: o spinner só existe durante a requisição, e quase nenhum teste
 * exercita esse instante.
 */

const SRC = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("spinner padronizado", () => {
  it("nenhum arquivo usa o Loader2 do lucide", () => {
    const infratores = walk(SRC)
      .filter((file) => /\bLoader2\b/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file));

    expect(infratores).toEqual([]);
  });

  /**
   * O `Loader` dimensiona por `style` INLINE (`width: 32px` no `md` padrão),
   * e estilo inline vence classe do Tailwind. Então `className="w-4 h-4"` não
   * encolhe nada: é código morto que convence quem escreveu de que o tamanho
   * foi ajustado, enquanto o spinner sai no tamanho padrão.
   *
   * Foi assim que o botão "Salvar" da numeração de propostas nasceu com um
   * spinner do dobro da altura do texto. O único controle é `size`.
   */
  it("ninguem tenta redimensionar o Loader por classe", () => {
    const infratores: string[] = [];

    for (const file of walk(SRC)) {
      const source = fs.readFileSync(file, "utf8");
      for (const tag of source.match(/<Loader\b[^>]*>/g) ?? []) {
        if (/\b[wh]-\d/.test(tag)) {
          infratores.push(`${path.relative(SRC, file)}: ${tag.trim()}`);
        }
      }
    }

    expect(infratores).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Botão em carregamento (2026-09-29). Três formas conviviam: o `Loader` com
  // `variant="button"`, o `Loader`/`Spinner` na variante `inline` (cor fixa:
  // num botão primário ele some no fundo, e o botão parece não ter loader) e
  // botões que só trocavam o texto para "Salvando...". Agora é uma só.
  // ---------------------------------------------------------------------

  const BUTTON = /<(Button|button|LandingButton)\b((?:[^>{]|\{(?:[^{}]|\{[^{}]*\})*\})*)>([\s\S]*?)<\/\1>/g;

  function buttons(): { where: string; inner: string }[] {
    const out: { where: string; inner: string }[] = [];
    for (const file of walk(SRC).filter((f) => f.endsWith(".tsx"))) {
      const source = fs.readFileSync(file, "utf8");
      for (const m of source.matchAll(BUTTON)) {
        const line = source.slice(0, m.index).split("\n").length;
        out.push({ where: `${path.relative(SRC, file)}:${line}`, inner: m[3] });
      }
    }
    return out;
  }

  it("dentro de botão, o Loader é sempre variant=\"button\" (herda a cor do texto)", () => {
    const infratores = buttons()
      .filter(({ inner }) => (inner.match(/<Loader\b[^>]*\/>/g) ?? []).some((tag) => !tag.includes('variant="button"')))
      .map(({ where }) => where);
    expect(infratores).toEqual([]);
  });

  it("botão que troca o texto para \"...ndo...\" mostra também o Loader", () => {
    const infratores = buttons()
      .filter(({ inner }) => /\?\s*"[^"]*ndo[^"]*\.\.\."/.test(inner) && !inner.includes("<Loader"))
      .map(({ where }) => where);
    expect(infratores).toEqual([]);
  });

  it("nem Spinner nem ícone girando: o carregamento é o Loader", () => {
    const infratores = walk(SRC)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => {
        const source = fs.readFileSync(file, "utf8");
        return /from "@\/components\/ui\/spinner"/.test(source) || /animate-spin/.test(source);
      })
      .map((file) => path.relative(SRC, file));
    expect(infratores).toEqual([]);
  });
});
