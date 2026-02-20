import crypto from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const BASE_URL =
  process.env.WHATSAPP_WEBHOOK_URL || "http://localhost:3000/api/whatsapp";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "test_secret";
const PHONE_NUMBER = process.env.WHATSAPP_TEST_PHONE;
const TENANT_ID = process.env.WHATSAPP_TEST_TENANT_ID;
const PROPOSAL_ID = process.env.WHATSAPP_TEST_PROPOSAL_ID;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
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
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: storageBucket || undefined,
  });
}

async function sendWebhook(text: string, phoneNumber = PHONE_NUMBER) {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15555555555",
                phone_number_id: "PHONE_NUMBER_ID",
              },
              contacts: [
                { profile: { name: "Test User" }, wa_id: phoneNumber },
              ],
              messages: [
                {
                  from: phoneNumber,
                  id: `wamid.${Date.now()}`,
                  timestamp: Date.now().toString(),
                  text: { body: text },
                  type: "text",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", APP_SECRET)
    .update(payloadString)
    .digest("hex");

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    },
    body: payloadString,
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Webhook failed (${response.status}): ${body}`);
  }
}

async function run() {
  if (!PHONE_NUMBER || !TENANT_ID || !PROPOSAL_ID) {
    throw new Error(
      "Set WHATSAPP_TEST_PHONE, WHATSAPP_TEST_TENANT_ID and WHATSAPP_TEST_PROPOSAL_ID before running this script.",
    );
  }

  initAdmin();
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const proposalRef = db.collection("proposals").doc(PROPOSAL_ID);
  const storagePath = `proposals/${TENANT_ID}/${PROPOSAL_ID}/proposal.pdf`;

  console.log("[TEST] Reset proposal PDF fields");
  await proposalRef.update({
    pdfPath: FieldValue.delete(),
    pdfUrl: FieldValue.delete(),
    pdfGeneratedAt: FieldValue.delete(),
  });

  try {
    await bucket.file(storagePath).delete();
    console.log("[TEST] Removed previous file in storage");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("No such object")) {
      throw error;
    }
  }

  console.log(
    "[TEST] Trigger webhook to list proposals and send proposal by id",
  );
  await sendWebhook("Listar propostas");
  await sendWebhook(`#${PROPOSAL_ID}`);

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const [fileExists] = await bucket.file(storagePath).exists();
  const proposalSnap = await proposalRef.get();
  const proposal = proposalSnap.data() || {};

  const hasPdfPath =
    typeof proposal.pdfPath === "string" && proposal.pdfPath.length > 0;
  const hasPdfUrl =
    typeof proposal.pdfUrl === "string" && proposal.pdfUrl.length > 0;
  const hasGeneratedAt = Boolean(proposal.pdfGeneratedAt);

  console.log("[TEST] Validation");
  console.log(" - storage file exists:", fileExists);
  console.log(" - proposal.pdfPath:", proposal.pdfPath || null);
  console.log(" - proposal.pdfUrl exists:", hasPdfUrl);
  console.log(" - proposal.pdfGeneratedAt exists:", hasGeneratedAt);

  if (!fileExists || !hasPdfPath || !hasPdfUrl || !hasGeneratedAt) {
    throw new Error(
      "Validation failed. Expected storage file and proposal PDF fields.",
    );
  }

  console.log("[TEST] Success");
}

run().catch((error) => {
  console.error("[TEST] Failed:", error);
  process.exit(1);
});
