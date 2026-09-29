/**
 * Âncoras da navbar e do rodapé das páginas de marketing do ERP.
 *
 * As seções `#recursos`, `#pricing` e companhia só existem na home. Nas páginas
 * de nicho e em `/funcionalidades` o link `#pricing` trocava o hash da página
 * atual, não achava alvo nenhum, e o clique morria sem aviso: "Planos" e
 * "Recursos" não faziam nada em cinco landings. Fora da home a âncora vira
 * `/#pricing`, uma navegação de verdade até a seção.
 */
export type LandingAnchor = `#${string}`;

export function isLandingAnchor(href: string): href is LandingAnchor {
  return href.startsWith("#");
}

export function anchorHref(href: string, pathname: string | null): string {
  if (!isLandingAnchor(href)) return href;
  return pathname === "/" ? href : `/${href}`;
}
