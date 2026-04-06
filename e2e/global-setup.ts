import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Poll individual emulator ports — firebase.json has no hub port configured,
// so the hub URL at :4400 is not reliably available (especially on Windows).
const FIRESTORE_READY_URL = "http://127.0.0.1:8080";
const AUTH_READY_URL = "http://127.0.0.1:9099";
const PID_FILE = path.join(process.cwd(), ".emulator-pid");
const MAX_WAIT_MS = 120000; // 2 min — Windows emulator startup is slower
const POLL_INTERVAL_MS = 1000;

async function waitForPort(url: string, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2000) });
      console.log(`[global-setup] ${label} is ready.`);
      return;
    } catch {
      // Not yet ready, continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `${label} did not become ready within ${MAX_WAIT_MS / 1000}s. Check firebase.json and emulator ports.`
  );
}

async function waitForEmulators(): Promise<void> {
  await Promise.all([
    waitForPort(FIRESTORE_READY_URL, "Firestore emulator (:8080)"),
    waitForPort(AUTH_READY_URL, "Auth emulator (:9099)"),
  ]);
  console.log("[global-setup] Firebase Emulators are ready.");
}

async function globalSetup(): Promise<void> {
  console.log("[global-setup] Starting Firebase Emulators...");

  const FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  const FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = FIREBASE_STORAGE_EMULATOR_HOST;

  // On Windows, spawn npx via cmd /c to avoid shell:true deprecation warning.
  // shell:true is unreliable with detached:true on Windows — use explicit cmd invocation.
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd" : "npx";
  const cmdArgs = isWin
    ? ["/c", "npx", "firebase", "emulators:start", "--project", "demo-proops-test", "--only", "auth,firestore,storage"]
    : ["firebase", "emulators:start", "--project", "demo-proops-test", "--only", "auth,firestore,storage"];

  const emulatorProcess: ChildProcess = spawn(cmd, cmdArgs, {
    detached: true,
    stdio: "pipe",
  });

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

  // Unref so the setup process does not keep a reference that blocks Playwright's lifecycle
  emulatorProcess.unref();

  try {
    await waitForEmulators();
  } catch (err) {
    emulatorProcess.kill();
    throw err;
  }

  // Dynamically import seedAll and clearAll after emulators are confirmed ready
  const { seedAll, clearAll } = await import("./seed/seed-factory");
  await clearAll();
  await seedAll();

  console.log("[global-setup] Seed data loaded. Emulators ready.");
}

export default globalSetup;
