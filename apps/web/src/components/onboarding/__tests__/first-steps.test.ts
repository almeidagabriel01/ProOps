import { describe, expect, it } from "vitest";

import { buildFirstStepsTasks, type FirstStepsCounts } from "../first-steps";

const EMPTY: FirstStepsCounts = {
  products: 0,
  services: 0,
  clients: 0,
  proposals: 0,
  members: 0,
};

const master = (maxUsers: number, hasLogo = false) => ({
  isMaster: true,
  hasPermission: () => false,
  maxUsers,
  hasLogo,
});

describe("buildFirstStepsTasks", () => {
  it("conta nova do master, plano Pro: tudo pendente, com equipe", () => {
    const tasks = buildFirstStepsTasks(EMPTY, master(2));
    expect(tasks.map((t) => t.id)).toEqual(["catalog", "contact", "proposal", "brand", "team"]);
    expect(tasks.every((t) => !t.done)).toBe(true);
  });

  it("plano de um usuário só não convida equipe", () => {
    const ids = buildFirstStepsTasks(EMPTY, master(1)).map((t) => t.id);
    expect(ids).not.toContain("team");
  });

  it("plano ilimitado convida equipe", () => {
    const ids = buildFirstStepsTasks(EMPTY, master(-1)).map((t) => t.id);
    expect(ids).toContain("team");
  });

  it("marca sozinho o que já existe", () => {
    const tasks = buildFirstStepsTasks(
      { products: 0, services: 3, clients: 1, proposals: 0, members: 1 },
      master(2, true),
    );
    const done = Object.fromEntries(tasks.map((t) => [t.id, t.done]));
    expect(done).toEqual({
      catalog: true,
      contact: true,
      proposal: false,
      brand: true,
      team: true,
    });
  });

  it("membro vê só o que pode criar, sem logo nem equipe", () => {
    const tasks = buildFirstStepsTasks(EMPTY, {
      isMaster: false,
      hasPermission: (pageId, action) => action === "create" && pageId === "proposals",
      maxUsers: -1,
      hasLogo: false,
    });
    expect(tasks.map((t) => t.id)).toEqual(["proposal"]);
  });

  it("membro só com serviços é levado ao cadastro de serviço", () => {
    const [catalog] = buildFirstStepsTasks(EMPTY, {
      isMaster: false,
      hasPermission: (pageId) => pageId === "services",
      maxUsers: 1,
      hasLogo: false,
    });
    expect(catalog.href).toBe("/services/new");
  });
});
