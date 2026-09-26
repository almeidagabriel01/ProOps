import { buildAudience, formatDueShort, planTaskNotifications } from "./tasks";

describe("quem enxerga a tarefa", () => {
  it("criador, responsável e citados, sem repetir", () => {
    expect(buildAudience("ana", "beto", ["beto", "carla", "ana"])).toEqual(["ana", "beto", "carla"]);
  });

  it("sem responsável nem citados, só quem criou", () => {
    expect(buildAudience("ana", null, [])).toEqual(["ana"]);
  });
});

describe("quem é avisado", () => {
  const base = { previousAssigneeId: null, previousMentionUids: [] as string[] };

  it("atribuir a outra pessoa avisa o responsável", () => {
    expect(
      planTaskNotifications({ ...base, actorUid: "ana", assigneeId: "beto", mentionUids: [] }),
    ).toEqual({ assigned: "beto", mentioned: [] });
  });

  it("atribuir a si mesmo não avisa ninguém", () => {
    expect(
      planTaskNotifications({ ...base, actorUid: "ana", assigneeId: "ana", mentionUids: ["ana"] }),
    ).toEqual({ assigned: null, mentioned: [] });
  });

  it("o responsável novo não recebe também o aviso de menção", () => {
    expect(
      planTaskNotifications({ ...base, actorUid: "ana", assigneeId: "beto", mentionUids: ["beto", "carla"] }),
    ).toEqual({ assigned: "beto", mentioned: ["carla"] });
  });

  it("editar sem mudar o responsável nem os citados não avisa de novo", () => {
    expect(
      planTaskNotifications({
        actorUid: "ana",
        previousAssigneeId: "beto",
        assigneeId: "beto",
        previousMentionUids: ["carla"],
        mentionUids: ["carla"],
      }),
    ).toEqual({ assigned: null, mentioned: [] });
  });

  it("só quem foi citado agora é avisado", () => {
    expect(
      planTaskNotifications({
        actorUid: "ana",
        previousAssigneeId: null,
        assigneeId: null,
        previousMentionUids: ["carla"],
        mentionUids: ["carla", "davi"],
      }),
    ).toEqual({ assigned: null, mentioned: ["davi"] });
  });
});

it("prazo curto na mensagem", () => {
  expect(formatDueShort("2026-09-26")).toBe("26/09");
  expect(formatDueShort(null)).toBeNull();
  expect(formatDueShort("26/09/2026")).toBeNull();
});
