import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Texto de venda que o produto não sustenta vira reclamação no primeiro uso.
 * Cada padrão abaixo é uma promessa que JÁ esteve publicada e estava errada:
 *
 * - "cartão" como forma de o cliente final pagar: o link de cobrança do Asaas
 *   aceita Pix e boleto. O cartão só paga a assinatura da própria ProOps.
 * - "a Lia responde no WhatsApp": o WhatsApp é um menu fixo de consultas; a Lia
 *   vive dentro do ERP e não tem ferramenta de WhatsApp.
 * - "Stripe" como integração da empresa: o Stripe cobra a assinatura da ProOps,
 *   não os clientes do tenant.
 *
 * E promessas que as cenas das landings de nicho poderiam sugerir: a
 * marcenaria não gera plano de corte, a automação não controla a casa (a
 * ProOps especifica e vende o projeto) e a segurança não calcula cobertura.
 */
const SRC = path.resolve(__dirname, "../../..");

const MARKETING_ROOTS = [
  "components/landing",
  "components/marketing",
  "lib/landing",
  "lib/niches/definitions",
  "app/funcionalidades",
];

const ALSO_SCANNED = ["components/onboarding/onboarding-steps.ts"];

function listFiles(dir: string): string[] {
  const abs = path.join(SRC, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const rel = path.join(dir, entry);
    if (entry === "__tests__") return [];
    if (statSync(path.join(SRC, rel)).isDirectory()) return listFiles(rel);
    return /\.(ts|tsx)$/.test(entry) ? [rel] : [];
  });
}

/** Remove comentários: a regra vale para o texto que vira tela, não para conversa de código. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const FILES = [...MARKETING_ROOTS.flatMap(listFiles), ...ALSO_SCANNED];

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  {
    name: "cartão como forma de o cliente final pagar",
    pattern: /(pix|boleto)[^.\n]{0,40}cart[aã]o|cart[aã]o[^.\n]{0,40}(pix|boleto)/i,
  },
  {
    name: "a Lia no WhatsApp",
    pattern: /\bLia\b[^.\n]{0,60}WhatsApp|WhatsApp[^.\n]{0,60}\bLia\b/,
  },
  { name: "Stripe como integração da empresa", pattern: /["'`>][^"'`<]*\bStripe\b[^"'`<]*["'`<]/ },
  // Afirmativos de propósito: o FAQ da marcenaria NEGA o plano de corte ("Não.
  // O projeto 3D e o plano de corte continuam no programa que você já usa"), e
  // negar o que o produto não faz é exatamente o texto honesto.
  {
    name: "plano de corte na marcenaria",
    pattern: /(?<!não )(gera|gerar|monta|montar|cria|criar|calcula|calcular|otimiza|otimizar)\w*[^.?\n]{0,30}(plano|lista) de corte/i,
  },
  {
    name: "a ProOps controlando a casa",
    pattern: /(?<!não )control(a|e|ar) (a casa|as luzes|a iluminação)/i,
  },
  { name: "cobertura calculada", pattern: /(?<!não )cobertura (calculada|autom[aá]tica)/i },
  // Não há depoimento, logo nem número de clientes para publicar (PRODUCT.md).
  { name: "prova social", pattern: /já usam a ProOps|junte-se a|milhares de|centenas de (empresas|clientes)/i },
  { name: "velocidade não medida", pattern: /em (poucos )?segundos/i },
];

/** Onde "Stripe" é verdade: a assinatura da própria ProOps. */
const STRIPE_ALLOWED = new Set([
  path.join("components/landing", "landing-pricing.tsx"),
  path.join("components/landing", "use-landing-page.ts"),
]);

describe("promessas que o produto não sustenta", () => {
  it("encontra os arquivos de marketing", () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  it.each(FORBIDDEN)("nenhum texto promete $name", ({ name, pattern }) => {
    const offenders = FILES.filter((file) => {
      if (name.startsWith("Stripe") && STRIPE_ALLOWED.has(file)) return false;
      const text = stripComments(readFileSync(path.join(SRC, file), "utf8"));
      return pattern.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
