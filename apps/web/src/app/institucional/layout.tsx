import type { ReactNode } from "react";

import { EmpresaShell } from "@/components/institucional/empresa-shell";
import { FONTES_INSTITUCIONAL } from "@/app/fonts/institucional";

/**
 * Shell of the root experience, which the proxy rewrites `proops.com.br/` onto.
 *
 * The chrome and the scoped type both come from shared modules, because the
 * company site now has a second layout for its apex-level pages and the two have
 * to be the same site. See `EmpresaShell` and `@/app/fonts/institucional`.
 */
export default function InstitucionalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <EmpresaShell className={FONTES_INSTITUCIONAL}>{children}</EmpresaShell>
  );
}
