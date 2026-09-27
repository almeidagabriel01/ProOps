/**
 * Semeia as demonstrações da conta free: uma por nicho, a partir dos datasets
 * de `scripts/demo/datasets/` e do motor `scripts/demo/engine.ts`.
 *
 * Firestore rules deixam qualquer usuário autenticado LER os documentos dos
 * tenants de demonstração (`isDemoRead`), e ninguém gravá-los (só Admin SDK).
 *
 * Idempotente: ids fixos e `set()` sobrescrevendo.
 * Rodar: `npx tsx src/scripts/seed-demo-tenant.ts` (todas as demonstrações), ou
 * o endpoint interno POST /internal/admin/seed-demo-tenant.
 */
import { DEMO_TENANT_ID } from "../shared/demo-tenant";
import { DEMO_DATASETS } from "./demo/datasets";
import { seedAllDemos, seedDemo } from "./demo/seed";
import type { SeedDemoResult } from "./demo/types";

export { DEMO_TENANT_ID, seedAllDemos };
export type SeedDemoTenantResult = SeedDemoResult;

/** Só a demonstração de automação (o tenant `demo`). */
export function seedDemoTenant(): Promise<SeedDemoResult> {
  return seedDemo(DEMO_DATASETS.automacao_residencial);
}

if (require.main === module) {
  import("../init")
    .then(() => seedAllDemos())
    .then((r) => {
      console.log("Demonstrações semeadas:", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Falha ao semear as demonstrações:", err);
      process.exit(1);
    });
}
