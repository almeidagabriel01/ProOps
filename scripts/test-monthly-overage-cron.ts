import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const BASE_URL =
  process.env.WHATSAPP_OVERAGE_CRON_URL ||
  "http://localhost:3000/api/internal/cron/whatsapp-overage-report";
const CRON_SECRET = process.env.CRON_SECRET;
const TENANT_ID = process.env.WHATSAPP_TEST_TENANT_ID;

function getPreviousMonthKey(baseDate = new Date()) {
  const d = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function initAdmin() {
  if (getApps().length > 0) return;

  const projectId = getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const clientEmail = getRequiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = getRequiredEnv("FIREBASE_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

async function run() {
  if (!CRON_SECRET) throw new Error("Missing env: CRON_SECRET");
  if (!TENANT_ID) throw new Error("Missing env: WHATSAPP_TEST_TENANT_ID");

  initAdmin();
  const db = getFirestore();
  const month = process.env.WHATSAPP_TEST_MONTH || getPreviousMonthKey();
  const usageRef = db
    .collection("whatsappUsage")
    .doc(TENANT_ID)
    .collection("months")
    .doc(month);

  console.log("[TEST] Preparing usage doc", { tenantId: TENANT_ID, month });
  await usageRef.set(
    {
      companyId: TENANT_ID,
      month,
      overageMessages: 50,
      totalMessages: 50,
      stripeReported: false,
      stripeEventId: FieldValue.delete(),
      stripeReportedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const url = `${BASE_URL}?month=${encodeURIComponent(month)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": CRON_SECRET,
    },
    body: JSON.stringify({ month }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  console.log("[TEST] Cron response", { status: response.status, payload });
  if (!response.ok) {
    throw new Error(`Cron request failed (${response.status})`);
  }

  const usageSnap = await usageRef.get();
  const usage = usageSnap.data() || {};
  const hasReported = usage.stripeReported === true;
  const hasEventId =
    typeof usage.stripeEventId === "string" && usage.stripeEventId.length > 0;

  console.log("[TEST] Post-check", {
    stripeReported: usage.stripeReported,
    stripeEventId: usage.stripeEventId || null,
  });

  if (!hasReported || !hasEventId) {
    throw new Error(
      "Validation failed: stripeReported/stripeEventId not updated.",
    );
  }

  console.log("[TEST] Success");
}

run().catch((error) => {
  console.error("[TEST] Failed:", error);
  process.exit(1);
});
