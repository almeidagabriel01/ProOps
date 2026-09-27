/**
 * Nichos que existem na plataforma: a fonte única dos ids. Tudo que varia por
 * nicho no backend é declarado como `Record<TenantNicheId, ...>`, então um
 * nicho novo que esqueça uma tabela não compila.
 *
 * Arquivo puro, sem import. Tem cópia no front (`apps/web/src/lib/niches/niche-ids.ts`)
 * e na lista do `firebase/firestore.rules`; as três são comparadas em
 * `apps/web/src/__tests__/niche-ids-parity.test.ts`.
 *
 * O id é gravado no tenant e não muda depois: `cortinas` continua `cortinas`
 * mesmo que o rótulo mostrado mude.
 */
export const TENANT_NICHES = [
  "automacao_residencial",
  "cortinas",
  "seguranca_eletronica",
] as const;

export type TenantNicheId = (typeof TENANT_NICHES)[number];

export function isTenantNiche(value: unknown): value is TenantNicheId {
  return typeof value === "string" && (TENANT_NICHES as readonly string[]).includes(value);
}
