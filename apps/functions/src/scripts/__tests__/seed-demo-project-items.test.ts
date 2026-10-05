/**
 * A obra de exemplo de cada nicho mostra a lista de itens com situações
 * variadas (a conta free vê "instalados x pendentes" com conteúdo), copiada da
 * proposta da obra sem nenhum valor.
 */

import { DEMO_DATASETS } from "../demo/datasets";
import { buildDemoDocs } from "../demo/engine";
import { PROJECT_ITEM_FIELDS } from "../../api/services/projects/project-items";

const NOW = new Date("2026-07-15T14:00:00.000Z");

describe.each(Object.entries(DEMO_DATASETS))("obra de exemplo de %s", (_niche, ds) => {
  const docs = buildDemoDocs(ds, { now: NOW, timestamp: (ms: number) => ({ __ts: ms }) } as never);
  const project = docs.find(
    (d) => d.op === "set" && d.path === `projects/proposal_${ds.project.proposalId}`,
  ) as { data: Record<string, unknown> } | undefined;
  const items = (project?.data.items ?? []) as Array<Record<string, unknown>>;

  it("tem os produtos da proposta, com instalado e pendente", () => {
    expect(items.length).toBeGreaterThanOrEqual(3);
    const statuses = new Set(items.map((i) => i.status));
    expect(statuses.has("installed")).toBe(true);
    expect(items.some((i) => i.status !== "installed")).toBe(true);
    expect(statuses.size).toBeGreaterThanOrEqual(3);
  });

  it("nenhum item carrega valor", () => {
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual([...PROJECT_ITEM_FIELDS].sort());
    }
    expect(JSON.stringify(items)).not.toMatch(/price|markup|total/i);
  });

  it("item marcado tem data e autor; pendente não", () => {
    for (const item of items) {
      if (item.status === "pending") {
        expect(item.statusAt).toBeNull();
      } else {
        expect(typeof item.statusAt).toBe("string");
        expect(item.statusByName).toBe("Equipe Demo");
      }
    }
  });
});

it("o dataset não pode marcar mais itens do que a proposta da obra tem", () => {
  const ds = DEMO_DATASETS.cortinas;
  const broken = {
    ...ds,
    project: { ...ds.project, itemStatuses: [...ds.project.itemStatuses, "installed", "installed", "installed"] },
  } as typeof ds;
  expect(() => buildDemoDocs(broken, { now: NOW, timestamp: (ms: number) => ms } as never)).toThrow(/itens/);
});
