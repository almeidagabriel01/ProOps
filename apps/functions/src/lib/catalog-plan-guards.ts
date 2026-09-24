import { resolveTenantCapabilities } from "./tenant-capabilities";

export type ImagesPlanCheck =
  | { allowed: true }
  | { allowed: false; limit: number; message: string };

/**
 * Teto de imagens por produto/servico do plano (Starter 2, Pro e Enterprise 3).
 *
 * Ate 2026-09 so a tela barrava: o schema do produto aceitava ate 20 imagens de
 * qualquer plano. A regra aqui tambem nao pune quem ja tinha mais fotos antes
 * de um downgrade: editar um item com 3 fotos continua possivel, so nao se
 * passa do que ja existia nem do teto do plano.
 */
export async function checkImagesWithinPlan(input: {
  tenantId: string;
  requested: number;
  existing?: number;
  isSuperAdmin?: boolean;
}): Promise<ImagesPlanCheck> {
  if (input.isSuperAdmin) return { allowed: true };

  const { limits } = await resolveTenantCapabilities(input.tenantId);
  const limit = limits.maxImagesPerProduct;
  if (limit === -1) return { allowed: true };

  if (input.requested <= limit || input.requested <= (input.existing ?? 0)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    limit,
    message: `Seu plano permite até ${limit} ${limit === 1 ? "imagem" : "imagens"} por item. Remova uma imagem ou faça upgrade do plano.`,
  };
}

/**
 * O editor de PDF abre para quem tem mais de um layout (Pro, Enterprise, add-on
 * de PDF parcial) ou a edicao de conteudo (add-on de PDF completo). E a mesma
 * regra que a pagina `/proposals/[id]/edit-pdf` aplica (`canAccessPage`).
 *
 * O que fica so na tela, de proposito: QUAL layout cada plano escolhe e se as
 * secoes podem ser editadas. A lista de layouts depende do nicho e vive no
 * front; copia-la para ca criaria uma segunda lista para divergir.
 */
export async function canUsePdfEditor(tenantId: string): Promise<boolean> {
  const { capabilities, limits } = await resolveTenantCapabilities(tenantId);
  return (
    capabilities.pdfEditor ||
    limits.maxPdfTemplates === -1 ||
    limits.maxPdfTemplates > 1
  );
}

export async function canCustomizeTheme(tenantId: string): Promise<boolean> {
  const { capabilities } = await resolveTenantCapabilities(tenantId);
  return capabilities.customTheme;
}

/**
 * Compara valores JSON ignorando a ordem das chaves. As guardas acima so
 * barram MUDANCA: um formulario que reenvia o valor ja gravado (tenant que
 * personalizou quando era Pro e depois caiu para o Starter) nao pode ser
 * recusado por isso.
 */
export function sameJsonValue(a: unknown, b: unknown): boolean {
  return stableStringify(a ?? null) === stableStringify(b ?? null);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => x.localeCompare(y));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
