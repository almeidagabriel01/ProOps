import * as fs from "fs";
import * as path from "path";

/**
 * Guards the composite index that the `checkManualSubscriptions` cron depends on.
 * Without it the cron throws `9 FAILED_PRECONDITION: query requires an index` in
 * production. The cron query is fixed (two equality fields + one range), so this
 * shape must not regress. See apps/functions/src/checkManualSubscriptions.ts.
 */
describe("firestore.indexes.json — manual subscriptions cron index", () => {
  const indexesPath = path.resolve(__dirname, "../../../../firebase/firestore.indexes.json");

  it("contains the users (isManualSubscription, subscriptionStatus, currentPeriodEnd) index", () => {
    const raw = fs.readFileSync(indexesPath, "utf8").replace(/^﻿/, "");
    const parsed = JSON.parse(raw) as {
      indexes: Array<{
        collectionGroup: string;
        queryScope: string;
        fields: Array<{ fieldPath: string; order?: string }>;
      }>;
    };

    const match = parsed.indexes.find((idx) => {
      if (idx.collectionGroup !== "users" || idx.queryScope !== "COLLECTION") return false;
      const paths = idx.fields.filter((f) => f.fieldPath !== "__name__").map((f) => f.fieldPath);
      return (
        paths.length === 3 &&
        paths[0] === "isManualSubscription" &&
        paths[1] === "subscriptionStatus" &&
        paths[2] === "currentPeriodEnd"
      );
    });

    expect(match).toBeDefined();
    for (const field of match!.fields) {
      expect(field.order).toBe("ASCENDING");
    }
  });
});
