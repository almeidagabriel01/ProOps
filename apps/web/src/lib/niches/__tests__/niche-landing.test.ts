import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildNicheLandingMetadata } from "@/lib/landing/niche-landing-metadata";
import { NICHE_REGISTRY, TENANT_NICHES } from "@/lib/niches/registry";
import { PUBLIC_MARKETING_ROUTES, PUBLIC_ROUTES } from "@/lib/auth/route-access";
import { APEX_OWNED_PATHS } from "@/lib/site/surfaces";
import { rotasDoSitemap } from "@/lib/site/host-seo";

/**
 * A landing de um nicho é uma página fina (`app/<caminho>/page.tsx`) que só
 * chama o builder de metadados e o componente de rota; todo o resto sai do
 * registro e da pasta do nicho. Estes testes cobram o que o compilador não
 * cobra: que a página exista, que aponte para o nicho certo, e que o caminho
 * não colida com outra rota.
 */
const APP_DIR = path.resolve(__dirname, "../../../app");

function pageFile(landingPath: string): string {
  return path.join(APP_DIR, landingPath, "page.tsx");
}

describe.each([...TENANT_NICHES])("landing do nicho %s", (niche) => {
  const { landingPath } = NICHE_REGISTRY[niche];

  it("tem a página fina, apontando para o próprio nicho", () => {
    const file = pageFile(landingPath);
    expect(fs.existsSync(file), `falta ${path.relative(APP_DIR, file)}`).toBe(true);
    const source = fs.readFileSync(file, "utf8");
    expect(source).toContain(`buildNicheLandingMetadata("${niche}")`);
    expect(source).toContain(`<NicheLandingRoute niche="${niche}"`);
  });

  it("é pública, está no sitemap do ERP e tem canonical absoluto", () => {
    expect(PUBLIC_MARKETING_ROUTES).toContain(landingPath);
    expect(rotasDoSitemap("erp").map((rota) => rota.path)).toContain(landingPath);
    const metadata = buildNicheLandingMetadata(niche);
    expect(metadata.alternates?.canonical).toBe(`https://erp.proops.com.br${landingPath}`);
    expect((metadata.openGraph as { url?: string } | undefined)?.url).toBe(
      `https://erp.proops.com.br${landingPath}`,
    );
  });

  it("declara a imagem de compartilhamento", () => {
    // O `openGraph` da página substitui o do layout inteiro, imagem junto: sem
    // isto o link da landing colado no WhatsApp saía sem prévia.
    const og = buildNicheLandingMetadata(niche).openGraph as { images?: unknown } | undefined;
    expect(og?.images).toEqual([expect.objectContaining({ url: "/opengraph-image.png" })]);
  });

  it("o caminho não colide com outra rota nem com o site da empresa", () => {
    const outrasRotas = PUBLIC_ROUTES.filter((rota) => rota !== landingPath);
    expect(outrasRotas).not.toContain(landingPath);
    expect(APEX_OWNED_PATHS as readonly string[]).not.toContain(landingPath);
    expect(landingPath).toMatch(/^\/[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("nenhuma página de nicho fora do registro", () => {
  it("toda página que renderiza NicheLandingRoute é de um nicho registrado", () => {
    const registrados = new Set<string>(TENANT_NICHES.map((niche) => NICHE_REGISTRY[niche].landingPath));
    const orfas: string[] = [];
    for (const entry of fs.readdirSync(APP_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(APP_DIR, entry.name, "page.tsx");
      if (!fs.existsSync(file)) continue;
      if (fs.readFileSync(file, "utf8").includes("<NicheLandingRoute") && !registrados.has(`/${entry.name}`)) {
        orfas.push(entry.name);
      }
    }
    expect(orfas).toEqual([]);
  });
});
