import {
  CreateProjectSchema,
  DeliveryAcceptanceSchema,
  PHOTO_MAX_BYTES,
  applyStageStatus,
  buildStagesFromTemplate,
  computeProgress,
  decodePhotoDataUrl,
  defaultTemplateForNiche,
  projectIdForProposal,
  resolveProjectSettings,
  type ProjectStage,
} from "./project-model";

let seq = 0;
const newId = () => `id${++seq}`;

beforeEach(() => {
  seq = 0;
});

describe("etapas padrão por nicho", () => {
  it("automação e cortinas nascem com roteiros diferentes, os dois terminando na entrega", () => {
    const automacao = defaultTemplateForNiche("automacao_residencial").map((s) => s.name);
    const cortinas = defaultTemplateForNiche("cortinas").map((s) => s.name);
    expect(automacao).toEqual(["Infraestrutura", "Instalação", "Configuração", "Entrega"]);
    expect(cortinas).toEqual(["Medição", "Produção", "Instalação", "Entrega"]);
  });

  it("nicho desconhecido ou vazio cai no de automação, sem quebrar", () => {
    expect(defaultTemplateForNiche(undefined)).toEqual(defaultTemplateForNiche("automacao_residencial"));
    expect(defaultTemplateForNiche("outro")).toEqual(defaultTemplateForNiche("automacao_residencial"));
  });
});

describe("resolveProjectSettings", () => {
  it("sem nada gravado: cria na aprovação e usa o roteiro do nicho", () => {
    const s = resolveProjectSettings(undefined, "cortinas");
    expect(s.autoCreateOnApproval).toBe(true);
    expect(s.stageTemplate[0].name).toBe("Medição");
  });

  it("o que a empresa gravou vence, inclusive desligar a criação automática", () => {
    const s = resolveProjectSettings(
      { autoCreateOnApproval: false, stageTemplate: [{ name: "Única", checklist: [] }] },
      "automacao_residencial",
    );
    expect(s).toEqual({ autoCreateOnApproval: false, stageTemplate: [{ name: "Única", checklist: [] }] });
  });

  it("roteiro gravado vazio não deixa o projeto nascer sem etapa", () => {
    expect(resolveProjectSettings({ stageTemplate: [] }, "cortinas").stageTemplate.length).toBeGreaterThan(0);
  });
});

describe("buildStagesFromTemplate", () => {
  it("toda etapa nasce pendente, com checklist desmarcado e sem fotos", () => {
    const stages = buildStagesFromTemplate([{ name: "Instalação", checklist: ["Fixar", "Testar"] }], newId);
    expect(stages).toEqual([
      {
        id: "id1",
        name: "Instalação",
        status: "pending",
        checklist: [
          { id: "id2", text: "Fixar", done: false, doneAt: null, doneBy: null },
          { id: "id3", text: "Testar", done: false, doneAt: null, doneBy: null },
        ],
        photos: [],
        completedAt: null,
      },
    ]);
  });
});

describe("computeProgress e applyStageStatus", () => {
  const stage = (status: ProjectStage["status"], done: boolean[]): ProjectStage => ({
    id: "s",
    name: "x",
    status,
    checklist: done.map((d, i) => ({ id: String(i), text: "t", done: d })),
    photos: [],
    completedAt: null,
  });

  it("percentual pelas etapas concluídas e contagem do checklist", () => {
    expect(computeProgress([stage("done", [true, true]), stage("in_progress", [true, false]), stage("pending", [])])).toEqual({
      stagesDone: 1,
      stagesTotal: 3,
      checklistDone: 3,
      checklistTotal: 4,
      percent: 33,
    });
    expect(computeProgress([]).percent).toBe(0);
  });

  it("concluir grava a data uma vez; reabrir limpa; o checklist não é marcado sozinho", () => {
    const done = applyStageStatus(stage("in_progress", [false]), "done", "2026-09-26T10:00:00Z");
    expect(done.completedAt).toBe("2026-09-26T10:00:00Z");
    expect(done.checklist[0].done).toBe(false);
    expect(applyStageStatus(done, "done", "2026-09-27T00:00:00Z").completedAt).toBe("2026-09-26T10:00:00Z");
    expect(applyStageStatus(done, "in_progress", "x").completedAt).toBeNull();
  });
});

describe("decodePhotoDataUrl", () => {
  const tiny = Buffer.from("fake-image").toString("base64");

  it("aceita webp, jpeg e png pequenos", () => {
    expect(decodePhotoDataUrl(`data:image/webp;base64,${tiny}`)).toMatchObject({ contentType: "image/webp", extension: "webp" });
    expect(decodePhotoDataUrl(`data:image/jpeg;base64,${tiny}`)).toMatchObject({ extension: "jpg" });
    expect(decodePhotoDataUrl(`data:image/png;base64,${tiny}`)).toMatchObject({ extension: "png" });
  });

  it("recusa SVG, PDF, texto e arquivo grande", () => {
    expect(decodePhotoDataUrl(`data:image/svg+xml;base64,${tiny}`)).toBeNull();
    expect(decodePhotoDataUrl(`data:application/pdf;base64,${tiny}`)).toBeNull();
    expect(decodePhotoDataUrl("não é data url")).toBeNull();
    const big = Buffer.alloc(PHOTO_MAX_BYTES + 1).toString("base64");
    expect(decodePhotoDataUrl(`data:image/webp;base64,${big}`)).toBeNull();
  });
});

describe("schemas", () => {
  it("criar exige a proposta ou um nome", () => {
    expect(CreateProjectSchema.safeParse({}).success).toBe(false);
    expect(CreateProjectSchema.safeParse({ proposalId: "p1" }).success).toBe(true);
    expect(CreateProjectSchema.safeParse({ title: "Garantia sala" }).success).toBe(true);
    expect(CreateProjectSchema.safeParse({ title: "x", tenantId: "t2" }).success).toBe(false);
  });

  it("aceite da entrega valida CPF/CNPJ e exige a confirmação", () => {
    const ok = { name: "Maria Souza", document: "529.982.247-25", accepted: true };
    expect(DeliveryAcceptanceSchema.safeParse(ok).success).toBe(true);
    expect(DeliveryAcceptanceSchema.safeParse({ ...ok, document: "111.111.111-11" }).success).toBe(false);
    expect(DeliveryAcceptanceSchema.safeParse({ ...ok, accepted: false }).success).toBe(false);
  });

  it("o id do projeto sai da proposta", () => {
    expect(projectIdForProposal("abc")).toBe("proposal_abc");
  });
});
