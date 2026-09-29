/**
 * Derruba os emuladores das capturas, e SÓ eles: mata a árvore do PID gravado
 * por `preparar.ts` e, no Windows, o que sobrar nas portas das capturas. As
 * portas do dia a dia (5001, 4000) ficam de fora de propósito, porque o
 * `npm run dev:backend` pode estar nelas.
 *
 *   npx tsx tests/capturas-do-erp/encerrar.ts
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { PORTAS_DOS_EMULADORES } from "./ambiente";

const ARQUIVO_PID = path.resolve(__dirname, "../../.capturas-pid");

if (fs.existsSync(ARQUIVO_PID)) {
  const pid = Number(fs.readFileSync(ARQUIVO_PID, "utf8"));
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    else process.kill(-pid, "SIGTERM");
  } catch {
    // já tinha saído
  }
  fs.rmSync(ARQUIVO_PID);
}

if (process.platform === "win32") {
  for (const porta of PORTAS_DOS_EMULADORES) {
    try {
      const saida = execSync(`netstat -ano | findstr ":${porta} "`, { encoding: "utf8", stdio: "pipe" });
      const pids = new Set(
        saida
          .split("\n")
          .filter((linha) => linha.includes("LISTENING"))
          .map((linha) => linha.trim().split(/\s+/).pop() ?? "")
          .filter((p) => /^\d+$/.test(p) && p !== "0"),
      );
      for (const p of pids) execSync(`taskkill /pid ${p} /T /F`, { stdio: "ignore" });
    } catch {
      // porta livre
    }
  }
}
console.log("[capturas] Emuladores das capturas encerrados.");
