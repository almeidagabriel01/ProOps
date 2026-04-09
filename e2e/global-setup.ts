import { spawn, spawnSync, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { seedAll, clearAll } from "./seed/seed-factory";

// Poll individual emulator ports — firebase.json has no hub port configured,
// so the hub URL at :4400 is not reliably available (especially on Windows).
const FIRESTORE_READY_URL = "http://127.0.0.1:8080";
const AUTH_READY_URL = "http://127.0.0.1:9099";
// Functions emulator: poll /api health endpoint to confirm the api function is loaded.
// Port 5001 becomes available before functions finish loading, so we poll an actual
// endpoint rather than the base URL. An "Unauthorized" response (401) means the function
// IS loaded and auth middleware is working — that is the expected response for a protected
// route with no auth token.
const FUNCTIONS_HEALTH_URL = "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api/v1/proposals";
const PID_FILE = path.join(process.cwd(), ".emulator-pid");
const MAX_WAIT_MS = 120000; // 2 min — Windows emulator startup is slower
const POLL_INTERVAL_MS = 2000;

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

async function waitForFunctionsEmulator(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const resp = await fetch(FUNCTIONS_HEALTH_URL, { signal: AbortSignal.timeout(3000) });
      // 401 = function loaded and auth middleware is enforcing auth (expected for protected route)
      // 200 = function loaded and returned data
      // Any non-404 response = functions emulator is serving the api function
      if (resp.status !== 404) {
        console.log(`[global-setup] Functions emulator (:5001) is ready (status ${resp.status}).`);
        return;
      }
      // 404 might mean functions are still loading — check body
      const text = await resp.text();
      if (!text.includes("does not exist")) {
        // 404 from Express route = function loaded but route doesn't exist (unexpected)
        console.log(`[global-setup] Functions emulator (:5001) is ready (404 from Express).`);
        return;
      }
      // "does not exist, valid functions are" — emulator up but functions not yet registered
    } catch {
      // Emulator not yet accepting connections
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Functions emulator did not become ready within ${MAX_WAIT_MS / 1000}s.`
  );
}

async function waitForEmulators(): Promise<void> {
  await Promise.all([
    waitForPort(FIRESTORE_READY_URL, "Firestore emulator (:8080)"),
    waitForPort(AUTH_READY_URL, "Auth emulator (:9099)"),
    waitForFunctionsEmulator(),
  ]);
  console.log("[global-setup] Firebase Emulators are ready.");
}

async function globalSetup(): Promise<void> {
  console.log("[global-setup] Building Cloud Functions...");
  const functionsDir = path.join(process.cwd(), "functions");
  const buildResult = spawnSync("npm", ["run", "build"], {
    cwd: functionsDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (buildResult.status !== 0) {
    throw new Error("[global-setup] functions build failed — emulator start aborted.");
  }
  console.log("[global-setup] Functions build complete.");

  console.log("[global-setup] Starting Firebase Emulators...");

  const FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  const FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = FIREBASE_STORAGE_EMULATOR_HOST;
  if (!process.env.CRON_SECRET) {
    process.env.CRON_SECRET = "test-cron-secret";
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_for_testing";
  }

  // Ensure Java is on PATH — Firebase emulators require the JVM.
  // Eclipse Adoptium (Temurin) installs to a versioned directory that Windows
  // does not always add to the shell PATH inherited by Node child processes.
  const JAVA_BIN =
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.10.7-hotspot\\bin";
  if (process.env.PATH && !process.env.PATH.includes(JAVA_BIN)) {
    process.env.PATH = `${JAVA_BIN};${process.env.PATH}`;
    console.log("[global-setup] Added Java to PATH:", JAVA_BIN);
  }

  // On Windows, spawn npx via cmd /c to avoid shell:true deprecation warning.
  // shell:true is unreliable with detached:true on Windows — use explicit cmd invocation.
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd" : "npx";
  const cmdArgs = isWin
    ? ["/c", "npx", "firebase", "emulators:start", "--project", "demo-proops-test", "--only", "auth,firestore,storage,functions"]
    : ["firebase", "emulators:start", "--project", "demo-proops-test", "--only", "auth,firestore,storage,functions"];

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

  await clearAll();
  await seedAll();

  console.log("[global-setup] Seed data loaded. Emulators ready.");
}

export default globalSetup;
