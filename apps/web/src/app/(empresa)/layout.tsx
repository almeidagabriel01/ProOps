import type { ReactNode } from "react";

import { EmpresaShell } from "@/components/institucional/empresa-shell";
import { FONTES_INSTITUCIONAL } from "@/app/fonts/institucional";

/**
 * Shell of the company site's own pages: /sobre, /manifesto, /produtos,
 * /carreiras, /fale-conosco.
 *
 * A route group, so the folder name is NOT in the URL. The pages have to sit at
 * apex level for two reasons: `proops.com.br/sobre` is the address a company
 * site has, and the `/institucional` subtree is permanently noindex because it is
 * the rewrite target of the apex root, hence a duplicate of it.
 *
 * Living at apex level is what makes `APEX_COMPANY_PATHS` load-bearing: it is the
 * list that keeps the apex serving these paths after the domain cutover, instead
 * of 301-ing them to `erp.proops.com.br`, which does not have them.
 */
export default function EmpresaLayout({ children }: { children: ReactNode }) {
  return (
    <EmpresaShell className={FONTES_INSTITUCIONAL}>{children}</EmpresaShell>
  );
}
