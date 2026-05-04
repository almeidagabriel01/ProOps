import * as admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { seedTenants } from "./data/tenants";
import { seedUsers } from "./data/users";
import { seedAiTenants } from "./data/ai";
import { seedProposals } from "./data/proposals";
import { seedTransactions } from "./data/transactions";
import { seedWallets } from "./data/wallets";
import { seedSistemas } from "./data/sistemas";
import { seedContacts } from "./data/contacts";
import { seedProducts } from "./data/products";

const PROJECT_ID = "demo-proops-test";

let app: admin.app.App | null = null;

function getAdminApp(): admin.app.App {
  if (app) return app;

  // Use existing app if already initialized (e.g., in watch mode)
  if (admin.apps.length > 0) {
    app = admin.apps[0]!;
    return app;
  }

  // Initialize Admin SDK pointing to emulators via env vars
  // FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must be set before this call
  app = admin.initializeApp({
    projectId: PROJECT_ID,
  });

  return app;
}

function getDb(): Firestore {
  return getAdminApp().firestore();
}

function getAuth(): Auth {
  return getAdminApp().auth();
}

/**
 * Seeds all test data deterministically into the Firebase Emulators.
 * Called once per test run from global-setup.ts after emulators are ready.
 */
export async function seedAll(): Promise<void> {
  console.log("[seed-factory] Starting full seed...");

  const db = getDb();
  const auth = getAuth();

  // Order matters: tenants first, then users (which reference tenants), then data
  await seedTenants(db);
  await seedUsers(auth, db);
  await seedAiTenants(auth, db);
  await seedWallets(db);
  await seedSistemas(db);
  await seedContacts(db);
  await seedProducts(db);
  await seedProposals(db);
  await seedTransactions(db);

  console.log("[seed-factory] Seed complete.");
}

/**
 * Clears all seeded data from the emulators.
 * Useful for per-suite reset when test isolation requires a clean state.
 */
export async function clearAll(): Promise<void> {
  console.log("[seed-factory] Clearing all seeded data...");

  const db = getDb();
  const auth = getAuth();

  const collections = ["tenants", "users", "wallets", "sistemas", "ambientes", "clients", "products", "proposals", "transactions"];

  for (const col of collections) {
    const snapshot = await db.collection(col).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    if (snapshot.docs.length > 0) await batch.commit();
  }

  // Delete seeded Auth users
  const uids = [
    "user-admin-alpha",
    "user-member-alpha",
    "user-admin-beta",
    "user-member-beta",
    "ai-admin-uid",
    "ai-member-uid",
    "ai-starter-uid",
    "ai-free-uid",
    "ai-free-role-uid",
  ];

  for (const uid of uids) {
    try {
      await auth.deleteUser(uid);
    } catch {
      // User may not exist, ignore
    }
  }

  // Clear AI subcollections for AI test tenants
  const aiTenantIds = ["ai-test", "ai-starter", "ai-free"];
  for (const tid of aiTenantIds) {
    for (const subcol of ["aiConversations", "aiUsage"]) {
      const subSnap = await db.collection(`tenants/${tid}/${subcol}`).get();
      if (subSnap.docs.length > 0) {
        const subBatch = db.batch();
        subSnap.docs.forEach((doc) => subBatch.delete(doc.ref));
        await subBatch.commit();
      }
    }
  }

  console.log("[seed-factory] Clear complete.");
}
