import { APEX_COMPANY_PATHS } from "@/lib/site/surfaces";

export interface EmpresaLink {
  href: string;
  rotulo: string;
  /** One line, shown in the footer and in the closing index. */
  resumo: string;
}

/**
 * The company site's own pages, in reading order.
 *
 * One list feeding the navbar, the footer and the closing index of the root
 * experience. Three copies of a menu is how a page ends up unreachable from one
 * of them, and this site has five destinations, which is exactly the number
 * where that starts happening.
 *
 * `href` is checked against `APEX_COMPANY_PATHS` at module load, below. That
 * list is what keeps the apex serving these paths after the domain cutover
 * instead of 301-ing them to the ERP, so a link here that is missing there is a
 * page that dies on the day of the flip, silently, months from now.
 */
export const EMPRESA_LINKS: EmpresaLink[] = [
  {
    href: "/sobre",
    rotulo: "Sobre",
    resumo: "Quem faz a ProOps, e por que ela existe.",
  },
  {
    href: "/manifesto",
    rotulo: "Manifesto",
    resumo: "O que decide se uma ideia entra no produto.",
  },
  {
    href: "/produtos",
    rotulo: "Produtos",
    resumo: "Um ERP para a empresa, um aplicativo para a pessoa.",
  },
  {
    href: "/carreiras",
    rotulo: "Carreiras",
    resumo: "Como a gente trabalha, e as vagas abertas.",
  },
  {
    href: "/fale-conosco",
    rotulo: "Contato",
    resumo: "Comercial, suporte, imprensa e parcerias.",
  },
];

const declarados = new Set<string>(APEX_COMPANY_PATHS);
const orfaos = EMPRESA_LINKS.filter((l) => !declarados.has(l.href));
if (orfaos.length > 0) {
  // Thrown at import time rather than reported at build time on purpose: the
  // failure this guards against is invisible until the cutover, and a page that
  // 301s to a host that does not serve it is worse than a page that never
  // shipped. Every surface that renders the menu imports this module, so any
  // dev server or test run that touches the company site hits it immediately.
  throw new Error(
    `EMPRESA_LINKS fora de APEX_COMPANY_PATHS: ${orfaos
      .map((l) => l.href)
      .join(", ")}. Sem isso a página leva 301 para o ERP depois da virada.`,
  );
}
