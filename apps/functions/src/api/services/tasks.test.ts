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
    ).toEqual({ assigned: "beto", mentioned: [], dueChangedFor: null });
  });

  it("atribuir a si mesmo não avisa ninguém", () => {
    expect(
      planTaskNotifications({ ...base, actorUid: "ana", assigneeId: "ana", mentionUids: ["ana"] }),
    ).toEqual({ assigned: null, mentioned: [], dueChangedFor: null });
  });

  it("o responsável novo não recebe também o aviso de menção", () => {
    expect(
      planTaskNotifications({ ...base, actorUid: "ana", assigneeId: "beto", mentionUids: ["beto", "carla"] }),
    ).toEqual({ assigned: "beto", mentioned: ["carla"], dueChangedFor: null });
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
    ).toEqual({ assigned: null, mentioned: [], dueChangedFor: null });
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
    ).toEqual({ assigned: null, mentioned: ["davi"], dueChangedFor: null });
  });
});

describe("prazo mudado", () => {
  const base = {
    actorUid: "dono",
    previousAssigneeId: "beto",
    assigneeId: "beto",
    previousMentionUids: [] as string[],
    mentionUids: [] as string[],
  };

  it("avisa o responsável quando outra pessoa muda o prazo (o caso relatado)", () => {
    expect(
      planTaskNotifications({ ...base, previousDueAt: "2026-09-25", dueAt: "2026-09-30" }).dueChangedFor,
    ).toBe("beto");
  });

  it("tirar o prazo também avisa", () => {
    expect(planTaskNotifications({ ...base, previousDueAt: "2026-09-25", dueAt: null }).dueChangedFor).toBe(
      "beto",
    );
  });

  it("salvar sem mudar o prazo não avisa", () => {
    expect(
      planTaskNotifications({ ...base, previousDueAt: "2026-09-25", dueAt: "2026-09-25" }).dueChangedFor,
    ).toBeNull();
  });

  it("quem mudou o próprio prazo não é avisado", () => {
    expect(
      planTaskNotifications({ ...base, actorUid: "beto", previousDueAt: "2026-09-25", dueAt: "2026-09-30" })
        .dueChangedFor,
    ).toBeNull();
  });

  it("passar para outra pessoa e mudar o prazo junto avisa só a atribuição", () => {
    const plan = planTaskNotifications({
      ...base,
      previousAssigneeId: "carla",
      previousDueAt: "2026-09-25",
      dueAt: "2026-09-30",
    });
    expect(plan).toEqual({ assigned: "beto", mentioned: [], dueChangedFor: null });
  });

  it("tarefa sem responsável não avisa ninguém", () => {
    expect(
      planTaskNotifications({
        ...base,
        previousAssigneeId: null,
        assigneeId: null,
        previousDueAt: null,
        dueAt: "2026-09-30",
      }).dueChangedFor,
    ).toBeNull();
  });
});

it("prazo curto na mensagem", () => {
  expect(formatDueShort("2026-09-26")).toBe("26/09");
  expect(formatDueShort(null)).toBeNull();
  expect(formatDueShort("26/09/2026")).toBeNull();
});
