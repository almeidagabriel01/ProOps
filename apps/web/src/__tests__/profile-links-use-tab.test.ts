import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Todo link para uma aba de `/profile` precisa usar `?tab=` com uma aba real.
 *
 * `app/profile/page.tsx` só lê `tab`, e um valor que ele não conhece cai em
 * "overview" sem erro nenhum. Foi assim que o "Fazer upgrade" do histórico da
 * Lia (`?section=plan`) levava o usuário para a visão geral, e não aos planos.
 */

const WEB_SRC = path.resolve(__dirname, "..");
const PROFILE_TABS = ["overview", "subscription", "billing"];
const PROFILE_LINK = /["'`]\/profile\?([^"'`]*)["'`]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("links para /profile", () => {
  it("usam ?tab= com uma aba que a página conhece", () => {
    const offenders: string[] = [];
    for (const file of walk(WEB_SRC)) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(PROFILE_LINK)) {
        const params = new URLSearchParams(match[1]);
        const tab = params.get("tab");
        // Callbacks de integração (`mp_code`, `mp_error`) não navegam por aba.
        const navigatesToTab = params.has("tab") || params.has("section");
        if (navigatesToTab && (!tab || !PROFILE_TABS.includes(tab))) {
          offenders.push(`${path.relative(WEB_SRC, file)}: /profile?${match[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
