import path from "path";
import fs from "fs";
import {
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  const serviceAccount: ServiceAccount = { projectId, clientEmail, privateKey };
  initializeApp({ credential: cert(serviceAccount) });
}

async function run() {
  initAdmin();
  const db = getFirestore();
  const phone = "5535998744200";
  const indexDoc = await db.collection("phoneNumberIndex").doc(phone).get();
  console.log(`phoneNumberIndex/${phone}: exists=${indexDoc.exists}`);
  if (indexDoc.exists) {
    console.log(indexDoc.data());
    const data = indexDoc.data();
    if (data?.userId) {
      const userDoc = await db.collection("users").doc(data.userId).get();
      console.log(`users/${data.userId}: exists=${userDoc.exists}`);
      if (userDoc.exists) {
        console.log(
          `User status: ${userDoc.data()?.status}, tenantId: ${userDoc.data()?.tenantId}`,
        );
      }
    }
    if (data?.tenantId) {
      const tenantDoc = await db.collection("tenants").doc(data.tenantId).get();
      console.log(`tenants/${data.tenantId}: exists=${tenantDoc.exists}`);
      if (tenantDoc.exists) {
        console.log(
          `Tenant whatsappEnabled: ${tenantDoc.data()?.whatsappEnabled}`,
        );
      }
    }
  }
}
run().catch(console.error);
