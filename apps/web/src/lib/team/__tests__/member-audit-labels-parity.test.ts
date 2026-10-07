/**
 * O histórico mostra o rótulo do front para cada ação gravada pelo backend:
 * as duas listas têm que ter as mesmas chaves e os mesmos textos.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBER_AUDIT_LABELS } from "../member-audit-labels";

const BACKEND = resolve(__dirname, "../../../../../functions/src/shared/member-audit-catalog.ts");

function backendLabels(): Record<string, string> {
  const source = readFileSync(BACKEND, "utf8");
  const block = source.slice(source.indexOf("MEMBER_AUDIT_ACTIONS = {"), source.indexOf("} as const;"));
  const entries = [...block.matchAll(/^\s+(\w+): "([^"]+)",$/gm)].map((m) => [m[1], m[2]]);
  return Object.fromEntries(entries);
}

describe("rótulos do histórico da equipe", () => {
  it("mesmas ações e mesmos textos do backend", () => {
    const backend = backendLabels();
    expect(Object.keys(backend).length).toBeGreaterThan(10);
    expect(MEMBER_AUDIT_LABELS).toEqual(backend);
  });
});
