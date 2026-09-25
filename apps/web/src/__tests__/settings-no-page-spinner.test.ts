import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Configurações carregam só com skeleton, e com o formato da tela que vem.
 *
 * Antes, abrir uma seção podia mostrar três coisas: o Luma em tela cheia (o
 * `SubscriptionGuard` o desenhava por cima do skeleton da rota), o Luma dentro
 * de um card vazio (Drive e Notas Fiscais) ou um skeleton de OUTRA tela. O
 * spinner só existe durante a requisição e quase nenhum teste exercita esse
 * instante, então a varredura é o que segura a regra.
 *
 * Spinner pequeno continua permitido: é o de botão (`variant="button"`) e o de
 * um recarregamento pedido com a tela já aberta, nunca o de abrir a tela.
 */

const SRC = path.resolve(__dirname, "..");

/** Tudo o que renderiza uma seção de Configurações. */
const ROOTS = [
  "app/settings",
  "components/features/team/team-management.tsx",
  "components/profile/two-factor-section.tsx",
];

function walk(target: string, out: string[] = []): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    out.push(target);
    return out;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = ROOTS.flatMap((root) => walk(path.join(SRC, root)));

/**
 * Spinner grande que NÃO é carregamento de tela: o sentinela do scroll
 * infinito da equipe, que só aparece com a lista já desenhada.
 */
const LOADER_GRANDE_PERMITIDO = new Set([
  "components/features/team/team-management.tsx",
]);

describe("Configurações: carregamento só com skeleton", () => {
  it("nenhuma seção usa o overlay de página", () => {
    const infratores = files
      .filter((file) =>
        /FullPageLoading|variant="(page|contained)"/.test(
          fs.readFileSync(file, "utf8"),
        ),
      )
      .map((file) => path.relative(SRC, file));

    expect(infratores).toEqual([]);
  });

  it('todo <Loader> é pequeno (size="sm"): o grande é spinner de tela', () => {
    const infratores: string[] = [];
    for (const file of files) {
      const rel = path.relative(SRC, file).replaceAll("\\", "/");
      if (LOADER_GRANDE_PERMITIDO.has(rel)) continue;
      const source = fs.readFileSync(file, "utf8");
      for (const tag of source.match(/<Loader\b[^>]*>/g) ?? []) {
        // Sem `size` o Loader sai no `md`, então a ausência também reprova.
        if (!/size="sm"/.test(tag)) {
          infratores.push(`${rel}: ${tag}`);
        }
      }
    }

    expect(infratores).toEqual([]);
  });

  it("o SubscriptionGuard não cobre o skeleton da rota com o Luma", () => {
    const source = fs.readFileSync(
      path.join(SRC, "components/shared/subscription-guard.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/FullPageLoading|<Loader\b/);
  });
});
