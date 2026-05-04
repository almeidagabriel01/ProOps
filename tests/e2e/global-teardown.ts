import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const PID_FILE = path.join(process.cwd(), ".emulator-pid");
// Ports used by Firebase emulators — must match firebase.json
const EMULATOR_PORTS = [5001, 8080, 9099, 9199, 4000];

function killProcessTree(pid: number): void {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGTERM");
    }
    console.log(`[global-teardown] Killed emulator process tree (PID ${pid}).`);
  } catch (err) {
    // Process may have already exited — not fatal, port-based cleanup follows
    console.warn(`[global-teardown] Could not kill PID ${pid}: ${err}`);
  }
}

// On Windows, cmd /c can exit before its children, leaving java.exe and node.exe
// orphaned on the emulator ports. Kill by port as a reliable fallback.
function killByPorts(ports: number[]): void {
  if (process.platform !== "win32") return;
  for (const port of ports) {
    try {
      const output = execSync(`netstat -ano | findstr ":${port} "`, {
        encoding: "utf8",
        stdio: "pipe",
      }).trim();
      const pids = new Set(
        output
          .split("\n")
          .map((line) => line.trim().split(/\s+/).pop() ?? "")
          .filter((p) => /^\d+$/.test(p) && p !== "0"),
      );
      for (const p of pids) {
        try {
          execSync(`taskkill /PID ${p} /F /T`, { stdio: "ignore" });
          console.log(`[global-teardown] Killed PID ${p} (was on port ${port}).`);
        } catch {
          // Already dead
        }
      }
    } catch {
      // Port not in use — nothing to do
    }
  }
}

async function globalTeardown(): Promise<void> {
  console.log("[global-teardown] Stopping Firebase Emulators...");

  if (fs.existsSync(PID_FILE)) {
    const pidStr = fs.readFileSync(PID_FILE, "utf8").trim();
    const pid = parseInt(pidStr, 10);
    if (!isNaN(pid)) {
      killProcessTree(pid);
    } else {
      console.warn(`[global-teardown] Invalid PID in file: "${pidStr}"`);
    }
    fs.unlinkSync(PID_FILE);
    console.log("[global-teardown] PID file removed.");
  } else {
    console.warn("[global-teardown] No PID file found — emulators may have already stopped.");
  }

  // Kill any remaining processes on emulator ports (handles orphaned cmd.exe children on Windows)
  killByPorts(EMULATOR_PORTS);

  console.log("[global-teardown] Done.");
}

export default globalTeardown;
