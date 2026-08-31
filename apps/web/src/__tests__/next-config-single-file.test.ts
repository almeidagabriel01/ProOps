import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Só pode existir UM arquivo de configuração do Next.
 *
 * O Next resolve nesta ordem (`next/dist/shared/lib/constants.js`):
 *
 *   ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.mts']
 *
 * O primeiro que existir vence e os outros são **ignorados por inteiro** — sem
 * aviso, sem log, sem erro de build. Foi o que aconteceu entre 24 e 27/08/2026:
 * um `next.config.js` criado só para `allowedDevOrigins` anulou o
 * `next.config.ts` e, com ele, TODOS os headers de segurança (CSP, HSTS,
 * X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP), o
 * `output: "standalone"`, o `poweredByHeader: false` e o `remotePatterns` das
 * imagens — em produção.
 *
 * O sintoma que denunciou foi banal: `next/image` recusando uma URL do Firebase
 * Storage. Os headers ausentes não davam sintoma nenhum.
 */

const CONFIG_FILES = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "next.config.mts",
];

const webRoot = path.resolve(__dirname, "../..");

describe("configuração do Next", () => {
  it("existe em exatamente um arquivo", () => {
    const encontrados = CONFIG_FILES.filter((name) =>
      fs.existsSync(path.join(webRoot, name)),
    );

    expect(
      encontrados,
      `Mais de um next.config encontrado: ${encontrados.join(", ")}. ` +
        "O Next usa só o primeiro da ordem de resolução e ignora o resto sem avisar. " +
        "Junte tudo num arquivo só.",
    ).toHaveLength(1);
  });

  it("é o arquivo que carrega os headers de segurança", () => {
    // Se alguém unificar no arquivo errado, a ausência de CSP volta em silêncio.
    const [nome] = CONFIG_FILES.filter((name) =>
      fs.existsSync(path.join(webRoot, name)),
    );
    const conteudo = fs.readFileSync(path.join(webRoot, nome), "utf8");

    expect(conteudo).toContain("Content-Security-Policy");
    expect(conteudo).toContain("Strict-Transport-Security");
    expect(conteudo).toContain("X-Frame-Options");
    expect(conteudo).toContain("remotePatterns");
  });
});
