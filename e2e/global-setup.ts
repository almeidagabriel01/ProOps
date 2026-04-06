import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

const EMULATOR_HUB_URL = "http://127.0.0.1:4400/emulators";
const PID_FILE = path.join(process.cwd(), ".emulator-pid");
const MAX_WAIT_MS = 60000;
const POLL_INTERVAL_MS = 1000;

async function waitForEmulators(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const res = await fetch(EMULATOR_HUB_URL);
      if (res.ok) {
        console.log("[global-setup] Firebase Emulators are ready.");
        return;
      }
    } catch {
      // Not yet ready, continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Emulators did not become ready within ${MAX_WAIT_MS / 1000}s. Check firebase.json and emulator ports.`
  );
}

async function globalSetup(): Promise<void> {
  console.log("[global-setup] Starting Firebase Emulators...");

  const FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  const FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = FIREBASE_STORAGE_EMULATOR_HOST;

  const emulatorProcess: ChildProcess = spawn(
    "npx",
    [
      "firebase",
      "emulators:start",
      "--project",
      "demo-proops-test",
      "--only",
      "auth,firestore,storage",
    ],
    {
      detached: true,
      stdio: "pipe",
      shell: process.platform === "win32",
    }
  );

  emulatorProcess.stdout?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[emulator] ${msg}`);
  });

  emulatorProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[emulator:err] ${msg}`);
  });

  if (emulatorProcess.pid) {
    fs.writeFileSync(PID_FILE, String(emulatorProcess.pid), "utf8");
    console.log(`[global-setup] Emulator PID ${emulatorProcess.pid} saved to ${PID_FILE}`);
  }

  await waitForEmulators();

  // Dynamically import seedAll after emulators are confirmed ready
  const { seedAll } = await import("./seed/seed-factory");
  await seedAll();

  console.log("[global-setup] Seed data loaded. Emulators ready.");
}

export default globalSetup;
