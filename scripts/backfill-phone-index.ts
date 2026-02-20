import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp, ServiceAccount } from "firebase-admin/app";
import { getFirestore, Timestamp, WriteBatch } from "firebase-admin/firestore";

type ConflictItem = {
  phone: string;
  existingUserId: string;
  newUserId: string;
};

type PhoneIndexDoc = {
  userId?: string;
  tenantId?: string;
};

const APPLY_MODE = process.argv.includes("--apply");
const BATCH_LIMIT = 500;

function normalizeDigits(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function initAdmin() {
  loadEnvLocal();

  if (getApps().length > 0) return;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars. Required: NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  initializeApp({ credential: cert(serviceAccount) });
}

async function run() {
  initAdmin();
  const db = getFirestore();

  console.log(
    `[Backfill] Starting phone index backfill (${APPLY_MODE ? "APPLY" : "DRY-RUN"})`,
  );

  const usersSnap = await db.collection("users").where("phoneNumber", "!=", null).get();
  console.log(`[Backfill] Users with phoneNumber != null: ${usersSnap.size}`);

  let createdCount = 0;
  let updatedCount = 0;
  let conflictCount = 0;
  let skippedNoTenant = 0;
  let skippedInvalidPhone = 0;
  const conflicts: ConflictItem[] = [];

  // Track assignments during this run to avoid overwriting in-run collisions.
  const resolvedPhoneOwner = new Map<string, string>();

  let batch: WriteBatch | null = APPLY_MODE ? db.batch() : null;
  let batchOps = 0;
  let committedBatches = 0;

  const flushBatch = async () => {
    if (!APPLY_MODE || !batch || batchOps === 0) return;
    await batch.commit();
    committedBatches += 1;
    batch = db.batch();
    batchOps = 0;
  };

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data() as { phoneNumber?: unknown; tenantId?: unknown };
    const userId = userDoc.id;

    const phone = normalizeDigits(userData.phoneNumber);
    if (!phone) {
      skippedInvalidPhone += 1;
      continue;
    }

    const tenantId = String(userData.tenantId || "").trim();
    if (!tenantId) {
      skippedNoTenant += 1;
      console.log(`[Backfill] Skipping user without tenantId: userId=${userId}`);
      continue;
    }

    let existingUserId = resolvedPhoneOwner.get(phone) || "";
    if (!existingUserId) {
      const indexRef = db.collection("phoneNumberIndex").doc(phone);
      const indexSnap = await indexRef.get();
      const indexData = (indexSnap.data() || {}) as PhoneIndexDoc;
      existingUserId = String(indexData.userId || "");
      if (existingUserId) {
        resolvedPhoneOwner.set(phone, existingUserId);
      }
    }

    if (existingUserId && existingUserId !== userId) {
      conflictCount += 1;
      conflicts.push({ phone, existingUserId, newUserId: userId });
      continue;
    }

    const indexRef = db.collection("phoneNumberIndex").doc(phone);
    const payload = {
      userId,
      tenantId,
      updatedAt: Timestamp.now(),
    };

    if (!existingUserId) {
      createdCount += 1;
    } else {
      updatedCount += 1;
    }

    resolvedPhoneOwner.set(phone, userId);

    if (APPLY_MODE && batch) {
      batch.set(indexRef, payload, { merge: true });
      batchOps += 1;
      if (batchOps >= BATCH_LIMIT) {
        await flushBatch();
      }
    }
  }

  await flushBatch();

  console.log("[Backfill] Summary");
  console.log(`createdCount=${createdCount}`);
  console.log(`updatedCount=${updatedCount}`);
  console.log(`conflictCount=${conflictCount}`);
  console.log(`skippedNoTenant=${skippedNoTenant}`);
  console.log(`skippedInvalidPhone=${skippedInvalidPhone}`);
  if (APPLY_MODE) {
    console.log(`committedBatches=${committedBatches}`);
  }

  if (conflicts.length > 0) {
    console.log("[Backfill] Conflicts");
    for (const c of conflicts) {
      console.log(
        `phone=${c.phone} existingUserId=${c.existingUserId} newUserId=${c.newUserId}`,
      );
    }
  }
}

run().catch((error) => {
  console.error("[Backfill] Fatal error:", error);
  process.exit(1);
});
