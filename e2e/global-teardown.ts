import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const PID_FILE = path.join(process.cwd(), ".emulator-pid");

function killProcessTree(pid: number): void {
  try {
    if (process.platform === "win32") {
      // On Windows, use taskkill to kill the entire process tree
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } else {
      // On Unix, kill the negative PID to kill the process group
      process.kill(-pid, "SIGTERM");
    }
    console.log(`[global-teardown] Killed emulator process tree (PID ${pid}).`);
  } catch (err) {
    // Process may have already exited — not a fatal error
    console.warn(`[global-teardown] Could not kill PID ${pid}: ${err}`);
  }
}

async function globalTeardown(): Promise<void> {
  console.log("[global-teardown] Stopping Firebase Emulators...");

  if (!fs.existsSync(PID_FILE)) {
    console.warn("[global-teardown] No PID file found — emulators may have already stopped.");
    return;
  }

  const pidStr = fs.readFileSync(PID_FILE, "utf8").trim();
  const pid = parseInt(pidStr, 10);

  if (isNaN(pid)) {
    console.warn(`[global-teardown] Invalid PID in file: "${pidStr}"`);
  } else {
    killProcessTree(pid);
  }

  fs.unlinkSync(PID_FILE);
  console.log("[global-teardown] PID file removed.");
}

export default globalTeardown;
