import { resolveTenantCapabilities } from "./tenant-capabilities";
import { getTenantDocCached } from "./tenant-doc-cache";
import {
  resolveCatalogImageLimit,
  type CatalogItemType,
} from "../shared/catalog-image-limits";

export type CatalogImagesCheck =
  | { allowed: true }
  | { allowed: false; limit: number; message: string };

/**
 * Teto de imagens por item do catálogo, pela regra de NICHO
 * (`shared/catalog-image-limits.ts`): a mesma que a tela aplica.
 *
 * Não pune dado anterior à regra: editar um item que já tinha mais fotos
 * continua possível, só não se passa do que já existia nem do teto.
 */
export async function checkCatalogImagesLimit(input: {
  tenantId: string;
  itemType: CatalogItemType;
  requested: number;
  existing?: number;
  isSuperAdmin?: boolean;
}): Promise<CatalogImagesCheck> {
  if (input.isSuperAdmin) return { allowed: true };

  const tenant = await getTenantDocCached(input.tenantId);
  const limit = resolveCatalogImageLimit({
    niche: typeof tenant.data?.niche === "string" ? tenant.data.niche : null,
    itemType: input.itemType,
  });

  if (input.requested <= limit || input.requested <= (input.existing ?? 0)) {
    return { allowed: true };
  }

  const noun = input.itemType === "service" ? "serviço" : "produto";
  return {
    allowed: false,
    limit,
    message: `É permitido adicionar até ${limit} ${limit === 1 ? "imagem" : "imagens"} por ${noun}.`,
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
 * As caixinhas de exibicao do PDF (mostrar preco, imagem, descricao...) valem
 * em todos os planos, e a empresa pode guardar a escolha como padrao em
 * `proposalDefaults`, o mesmo objeto do estilo do editor de PDF. So o estilo e
 * do editor: mudanca que toca apenas estas chaves, com valor booleano, nao
 * pede a capacidade.
 */
export const PDF_DISPLAY_DEFAULT_KEYS: ReadonlySet<string> = new Set([
  "showProductImages",
  "showProductDescriptions",
  "showProductPrices",
  "showProductMeasurements",
  "showProductQuantities",
  "showSubtotals",
  "showEnvironmentSubtotals",
  "showPaymentTerms",
  "showLogo",
  "showValidUntil",
  "showNotes",
]);

export function onlyDisplayDefaultsChanged(next: unknown, current: unknown): boolean {
  if (!next || typeof next !== "object" || Array.isArray(next)) return false;
  const nextObj = next as Record<string, unknown>;
  const currentObj =
    current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(nextObj), ...Object.keys(currentObj)]);
  for (const key of keys) {
    if (sameJsonValue(nextObj[key], currentObj[key])) continue;
    if (!PDF_DISPLAY_DEFAULT_KEYS.has(key)) return false;
    if (typeof nextObj[key] !== "boolean") return false;
  }
  return true;
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
