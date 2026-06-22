/**
 * One-shot maintenance: marks the legacy `error_issues` that were produced by
 * the pre-fix observability capture as `resolved`.
 *
 * Two classes of legacy noise are targeted (see the June 2026 observability fix):
 *   1. Broken synthetic captures with `title === "[object Object]"` — caused by
 *      `toIngestInput` not reading name/message off a plain object (fixed).
 *   2. Web-reported client validation errors (`errorType === "ApiError"`) — the
 *      frontend used to report every 4xx; now it only reports 5xx (fixed).
 *
 * Safety:
 *   - NEVER touches `severity === "critical"` issues. The cron index issue
 *     (`checkManualSubscriptions` FAILED_PRECONDITION) is critical and a REAL
 *     error; it must only be resolved after the composite index is Enabled and
 *     the cron has run clean. Resolve that one manually from the dashboard.
 *   - Idempotent: skips issues already `resolved`.
 *   - DRY RUN by default unless APPLY=1 is set, so you can preview first.
 *
 * Run AFTER the code fix is deployed — otherwise a fresh occurrence re-opens the
 * issue (ingest flips `resolved` back to `unresolved`).
 *
 * Usage (preview):
 *   cd apps/functions
 *   GCLOUD_PROJECT=erp-softcode-prod npx ts-node src/scripts/resolve-legacy-observability-noise.ts
 * Usage (apply):
 *   GCLOUD_PROJECT=erp-softcode-prod APPLY=1 npx ts-node src/scripts/resolve-legacy-observability-noise.ts
 */

import { getFirestore } from "firebase-admin/firestore";
import { initScriptAdmin } from "./_script-init";

const ERROR_ISSUES_COLLECTION = "error_issues";

interface IssueDoc {
  title?: string;
  errorType?: string;
  severity?: string;
  status?: string;
  source?: string;
  route?: string;
}

/** Pure predicate: is this a legacy-noise issue safe to auto-resolve? */
export function isLegacyNoiseIssue(issue: IssueDoc): boolean {
  if (issue.severity === "critical") return false;
  if (issue.status === "resolved") return false;
  return issue.title === "[object Object]" || issue.errorType === "ApiError";
}

async function main(): Promise<void> {
  const projectId = initScriptAdmin();
  const apply = process.env.APPLY === "1";
  const db = getFirestore();

  const snap = await db.collection(ERROR_ISSUES_COLLECTION).get();
  const targets = snap.docs.filter((d) => isLegacyNoiseIssue(d.data() as IssueDoc));

  console.log(
    `[${projectId}] scanned ${snap.size} error_issues, ${targets.length} legacy-noise match` +
      ` (mode: ${apply ? "APPLY" : "DRY RUN"}).`,
  );

  for (const doc of targets) {
    const data = doc.data() as IssueDoc;
    console.log(
      `  - ${doc.id.slice(0, 12)} | sev=${data.severity} | type=${data.errorType}` +
        ` | route=${data.route ?? "-"} | title="${(data.title ?? "").slice(0, 60)}"`,
    );
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with APPLY=1 to resolve these.");
    return;
  }

  const nowIso = new Date().toISOString();
  let updated = 0;
  // Chunked writes (Firestore batch cap is 500); our volume is tiny but keep it safe.
  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    for (const doc of targets.slice(i, i + 400)) {
      batch.update(doc.ref, { status: "resolved", resolvedAt: nowIso });
      updated += 1;
    }
    await batch.commit();
  }

  console.log(`\nResolved ${updated} legacy-noise issue(s).`);
}

main().catch((err: Error) => {
  console.error("\n❌ Erro fatal:", err.message);
  process.exit(1);
});
