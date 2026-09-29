/**
 * Os endereços das páginas de funcionalidade (`/funcionalidades/<slug>`), na
 * ordem em que a lista as mostra.
 *
 * Separado de `funcionalidades.ts` de propósito: o sitemap (`lib/site/host-seo.ts`)
 * precisa dos caminhos e não pode arrastar os ícones e o catálogo inteiro. O tipo
 * `FuncionalidadeSlug` sai daqui, então a lista de conteúdo é um `Record` que não
 * compila se um slug ficar sem página.
 */
export const FUNCIONALIDADE_SLUGS = [
  "crm",
  "contatos",
  "catalogo",
  "propostas",
  "aceite-online",
  "pdf-da-proposta",
  "obras",
  "agenda",
  "pos-venda",
  "financeiro",
  "fluxo-de-caixa-e-dre",
  "notas-fiscais",
  "lia",
  "equipe-e-seguranca",
  "no-dia-a-dia",
] as const;

export type FuncionalidadeSlug = (typeof FUNCIONALIDADE_SLUGS)[number];

export const caminhoDaFuncionalidade = (slug: FuncionalidadeSlug) => `/funcionalidades/${slug}` as const;
