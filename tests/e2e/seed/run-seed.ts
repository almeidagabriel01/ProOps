// Sets emulator env vars before importing seed-factory (which initializes Admin SDK on import)
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";

import { clearAll, seedAll } from "./seed-factory";

async function main() {
  await clearAll();
  await seedAll();
}

main().catch((err) => {
  console.error("[run-seed] Fatal error:", err);
  process.exit(1);
});
