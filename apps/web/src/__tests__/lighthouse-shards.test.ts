import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O job do Lighthouse no CI é dividido em shards, e cada shard passa as suas
 * URLs por `--collect.url`, o que SOBREPÕE a lista do `lighthouserc.json`.
 *
 * Consequência: uma URL acrescentada só no arquivo continua sendo medida no
 * `npm run test:lighthouse` local, mas sai do CI em silêncio, sem nenhum gate
 * reprovando. E uma URL que só existe na matriz escapa dos tetos pensados para
 * ela. Este guard exige que as duas listas sejam a mesma, sem repetição.
 */

const REPO_ROOT = path.resolve(__dirname, "../../../..");

function readConfigPaths(): string[] {
  const config = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "lighthouserc.json"), "utf8"),
  ) as { ci: { collect: { url: string[] } } };
  return config.ci.collect.url.map((url) => new URL(url).pathname);
}

function readShardPaths(): string[][] {
  const workflow = fs.readFileSync(
    path.join(REPO_ROOT, ".github", "workflows", "test-suite.yml"),
    "utf8",
  );
  return workflow
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*urls:\s*"([^"]*)"\s*$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1].trim().split(/\s+/));
}

describe("Lighthouse: shards do CI cobrem o lighthouserc.json", () => {
  it("a matriz do test-suite.yml declara shards", () => {
    expect(readShardPaths().length).toBeGreaterThan(1);
  });

  it("a união dos shards é exatamente a lista do lighthouserc.json", () => {
    const shardPaths = readShardPaths().flat();
    expect(new Set(shardPaths).size).toBe(shardPaths.length);
    expect([...shardPaths].sort()).toEqual([...readConfigPaths()].sort());
  });
});
