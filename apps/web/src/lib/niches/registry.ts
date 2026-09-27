/**
 * Espelho no front do registro de nichos do backend
 * (`apps/functions/src/shared/niches.ts`), com os campos que o front também usa,
 * mais o que só o front conhece: o rótulo e o caminho da landing.
 *
 * Nicho novo = uma entrada aqui e uma lá. O id é a chave; `TenantNiche` e
 * `TENANT_NICHES` saem dela. A paridade dos dois registros e do
 * `firebase/firestore.rules` é garantida por
 * `src/__tests__/niche-registry-parity.test.ts`.
 *
 * Arquivo puro, sem import: é lido pelo proxy (rotas públicas), pelo sitemap e
 * por toda página. Texto de landing e configuração de tela ficam em
 * `lib/niches/definitions/<id>/`.
 */

export interface VisitType {
  id: string;
  label: string;
  durationMin: number;
}

export interface WebNicheEntry {
  /** Nome do nicho na interface. */
  label: string;
  /** Caminho da landing do nicho no ERP. É SEO: não muda depois de publicado. */
  landingPath: `/${string}`;
  demoTenantId: string;
  productImageLimit: number;
  defaultVisitType: VisitType;
}

export const NICHE_REGISTRY = {
  automacao_residencial: {
    label: "Automação Residencial",
    landingPath: "/automacao-residencial",
    demoTenantId: "demo",
    productImageLimit: 1,
    defaultVisitType: { id: "visita_tecnica", label: "Visita técnica", durationMin: 60 },
  },
  cortinas: {
    label: "Persianas e Toldos",
    landingPath: "/decoracao",
    demoTenantId: "demo-cortinas",
    productImageLimit: 3,
    defaultVisitType: { id: "medicao", label: "Medição", durationMin: 60 },
  },
  seguranca_eletronica: {
    label: "Segurança Eletrônica",
    landingPath: "/seguranca-eletronica",
    demoTenantId: "demo-seguranca",
    productImageLimit: 1,
    defaultVisitType: { id: "vistoria_tecnica", label: "Vistoria técnica", durationMin: 60 },
  },
} satisfies Record<string, WebNicheEntry>;

export type TenantNicheId = keyof typeof NICHE_REGISTRY;

export const TENANT_NICHES = Object.keys(NICHE_REGISTRY) as TenantNicheId[];

export function isTenantNiche(value: unknown): value is TenantNicheId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(NICHE_REGISTRY, value);
}

/** Nicho de quem não tem um válido: é o que o sistema sempre assumiu. */
export const DEFAULT_NICHE: TenantNicheId = "automacao_residencial";

export function nicheEntry(niche: unknown): WebNicheEntry {
  return NICHE_REGISTRY[isTenantNiche(niche) ? niche : DEFAULT_NICHE];
}

export function mapNiches<T>(pick: (entry: WebNicheEntry, niche: TenantNicheId) => T): Record<TenantNicheId, T> {
  return Object.fromEntries(
    TENANT_NICHES.map((niche) => [niche, pick(NICHE_REGISTRY[niche], niche)]),
  ) as Record<TenantNicheId, T>;
}

/** Caminhos das landings de nicho, na ordem do registro. */
export const NICHE_LANDING_PATHS = TENANT_NICHES.map((niche) => NICHE_REGISTRY[niche].landingPath);
