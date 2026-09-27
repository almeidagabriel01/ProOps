import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import type { TenantNicheId } from "../../shared/niches";
import { DEMO_DATASETS } from "./datasets";
import { buildDemoDocs, demoResultCounts } from "./engine";
import type { DemoDataset, SeedDemoResult } from "./types";

const MAX_BATCH_WRITES = 500;

/** Grava (ou regrava) uma demonstração. Idempotente: ids fixos e `set`. */
export async function seedDemo(dataset: DemoDataset, now: Date = new Date()): Promise<SeedDemoResult> {
  const db = getFirestore();
  const writes = buildDemoDocs(dataset, { now, timestamp: (ms) => Timestamp.fromMillis(ms) });

  for (let start = 0; start < writes.length; start += MAX_BATCH_WRITES) {
    const batch = db.batch();
    for (const write of writes.slice(start, start + MAX_BATCH_WRITES)) {
      const [collection, id] = write.path.split("/");
      const ref = db.collection(collection).doc(id);
      if (write.op === "set") batch.set(ref, write.data);
      else batch.delete(ref);
    }
    await batch.commit();
  }

  const result = demoResultCounts(dataset);
  logger.info("seedDemo complete", { niche: dataset.niche, ...result });
  return result;
}

/** Todas as demonstrações, uma por nicho. */
export async function seedAllDemos(): Promise<Record<TenantNicheId, SeedDemoResult>> {
  const results = {} as Record<TenantNicheId, SeedDemoResult>;
  for (const [niche, dataset] of Object.entries(DEMO_DATASETS) as Array<[TenantNicheId, DemoDataset]>) {
    results[niche] = await seedDemo(dataset);
  }
  return results;
}
