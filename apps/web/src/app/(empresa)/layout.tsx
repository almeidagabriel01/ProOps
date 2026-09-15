import type { ReactNode } from "react";

import { EmpresaShell } from "@/components/institucional/empresa-shell";
import { FONTES_INSTITUCIONAL } from "@/app/fonts/institucional";

/**
 * Shell of the whole company site: the root experience at `/institucional`,
 * which the proxy rewrites the apex root onto, plus `/sobre`, `/manifesto`,
 * `/produtos` and `/fale-conosco`.
 *
 * A route group, so the folder name is NOT in the URL. The pages have to sit at
 * apex level for two reasons: `proops.com.br/sobre` is the address a company
 * site has, and the `/institucional` subtree is permanently noindex because it is
 * the rewrite target of the apex root, hence a duplicate of it.
 *
 * Living at apex level is what makes `APEX_COMPANY_PATHS` load-bearing: it is the
 * list that keeps the apex serving these paths after the domain cutover, instead
 * of 301-ing them to `erp.proops.com.br`, which does not have them.
 *
 * **The five pages share ONE layout, and that is load-bearing.** They used to be
 * two: `app/institucional/layout.tsx` for the root and this one for the rest,
 * both mounting the same `EmpresaShell`. Two layouts means two React subtrees,
 * so crossing between the root and a sub-page unmounted the shell and built a
 * new one, which cost three things at once and none of them failed loudly: the
 * curtain's provider was destroyed mid-navigation, so the panel vanished instead
 * of lifting; Lenis was destroyed and rebuilt behind a `requestIdleCallback`, so
 * the inertial scroll was simply gone for up to two seconds after arriving; and
 * the pointer field started over. Moving `institucional/` inside this group made
 * `(empresa)` the common ancestor, so the shell now survives every navigation
 * inside the site. Do not give any page here a layout of its own.
 */
export default function EmpresaLayout({ children }: { children: ReactNode }) {
  return (
    <EmpresaShell className={FONTES_INSTITUCIONAL}>{children}</EmpresaShell>
  );
}
