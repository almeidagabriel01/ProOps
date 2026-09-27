/**
 * Projetos de instalação: permissão própria (pageId projects), isolamento por
 * empresa, técnico da mesma equipe, checklist que põe a etapa em andamento,
 * fotos pelo backend com teto de armazenamento e configurações só do admin.
 */

import type { Request, Response } from "express";

const hasPagePermission = jest.fn();
const svc = {
  createProjectFromProposal: jest.fn(),
  createStandaloneProject: jest.fn(),
  createProjectShareLink: jest.fn(),
  deleteProjectPhotos: jest.fn(),
  isStorageOverQuota: jest.fn(),
  loadProjectSettings: jest.fn(),
  saveProjectSettings: jest.fn(),
  storeProjectPhoto: jest.fn(),
};

let projects: Record<string, Record<string, unknown>>;
let docs: Record<string, Record<string, Record<string, unknown>>>;
const projectUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
const projectDeletes: string[] = [];
const docSets: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];
const docDeletes: Array<{ collection: string; id: string }> = [];
let autoId = 0;

const googleSync = { enabled: false, provider: "google", status: "disabled" };
const syncEventToGoogle = jest.fn();
const deleteEventFromGoogleIfNeeded = jest.fn();
jest.mock("./calendar.controller", () => ({
  ...jest.requireActual("./calendar.controller"),
  syncEventToGoogle: (...a: unknown[]) => syncEventToGoogle(...a),
  deleteEventFromGoogleIfNeeded: (...a: unknown[]) => deleteEventFromGoogleIfNeeded(...a),
}));

const createNotification = jest.fn();
jest.mock("../services/notification.service", () => ({
  NotificationService: { createNotification: (...a: unknown[]) => createNotification(...a) },
}));

jest.mock("../../lib/frontend-app-url", () => ({
  resolveFrontendAppOrigin: () => "https://erp.test",
}));

const isStatusApproved = jest.fn();
jest.mock("./proposals.controller", () => ({
  isStatusApproved: (...a: unknown[]) => isStatusApproved(...a),
}));

jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));

jest.mock("../../init", () => {
  const projectRef = (id: string) => ({
    id,
    get: async () => ({ exists: !!projects[id], data: () => projects[id] }),
    update: async (data: Record<string, unknown>) => {
      projectUpdates.push({ id, data });
      projects[id] = { ...projects[id], ...data };
    },
    delete: async () => {
      projectDeletes.push(id);
    },
  });
  return {
    db: {
      collection: (name: string) => {
        if (name === "projects") return { doc: projectRef };
        const col = docs[name] ?? {};
        let filter: [string, unknown] | null = null;
        const q = {
          where: (field: string, _op: string, value: unknown) => {
            filter = [field, value];
            return q;
          },
          limit: () => q,
          get: async () => ({
            docs: Object.entries(col)
              .filter(([, d]) => !filter || d[filter[0]] === filter[1])
              .map(([id, d]) => ({ id, data: () => d })),
          }),
        };
        return {
          ...q,
          doc: (given?: string) => {
            const id = given ?? `auto_${++autoId}`;
            return {
              id,
              get: async () => ({ id, exists: !!docs[name]?.[id], data: () => docs[name]?.[id] }),
              set: async (data: Record<string, unknown>) => {
                docs[name] = { ...(docs[name] ?? {}), [id]: data };
                docSets.push({ collection: name, id, data });
              },
              delete: async () => {
                delete docs[name]?.[id];
                docDeletes.push({ collection: name, id });
              },
            };
          },
        };
      },
      runTransaction: async (fn: (t: unknown) => Promise<unknown>) =>
        fn({
          get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
          update: (ref: { id: string }, data: Record<string, unknown>) => {
            projectUpdates.push({ id: ref.id, data });
            projects[ref.id] = { ...projects[ref.id], ...data };
          },
        }),
    },
  };
});

jest.mock("../services/projects/project.service", () => {
  const actual = jest.requireActual("../services/projects/project.service");
  return {
    PROJECTS_COLLECTION: "projects",
    projectPhotoPath: actual.projectPhotoPath,
    loadProjectOfTenant: async (id: string, tenantId: string) => {
      const data = projects[id];
      if (!data || data.tenantId !== tenantId) return null;
      return {
        ref: {
          id,
          update: async (update: Record<string, unknown>) => {
            projectUpdates.push({ id, data: update });
            projects[id] = { ...projects[id], ...update };
          },
          delete: async () => {
            projectDeletes.push(id);
          },
        },
        data,
      };
    },
    createProjectFromProposal: (...a: unknown[]) => svc.createProjectFromProposal(...a),
    createStandaloneProject: (...a: unknown[]) => svc.createStandaloneProject(...a),
    createProjectShareLink: (...a: unknown[]) => svc.createProjectShareLink(...a),
    deleteProjectPhotos: (...a: unknown[]) => svc.deleteProjectPhotos(...a),
    isStorageOverQuota: (...a: unknown[]) => svc.isStorageOverQuota(...a),
    loadProjectSettings: (...a: unknown[]) => svc.loadProjectSettings(...a),
    saveProjectSettings: (...a: unknown[]) => svc.saveProjectSettings(...a),
    storeProjectPhoto: (...a: unknown[]) => svc.storeProjectPhoto(...a),
  };
});

import {
  addChecklistItem,
  createDeliveryLink,
  createProject,
  deleteProject,
  listProjectAssignees,
  scheduleStage,
  toggleChecklistItem,
  unscheduleStage,
  updateProject,
  updateProjectSettings,
  updateStage,
  uploadStagePhoto,
} from "./projects.controller";

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

function fakeReq(params: Record<string, string> = {}, body: unknown = {}, role = "MEMBER") {
  return {
    params,
    body,
    user: { uid: "u1", tenantId: "t1", role },
  } as unknown as Request;
}

const TINY_WEBP = `data:image/webp;base64,${Buffer.from("img").toString("base64")}`;

function stage(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "Instalação",
    status: "pending",
    checklist: [{ id: "i1", text: "Fixar", done: false }],
    photos: [],
    completedAt: null,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  projectUpdates.length = 0;
  projectDeletes.length = 0;
  docSets.length = 0;
  docDeletes.length = 0;
  syncEventToGoogle.mockResolvedValue(googleSync);
  deleteEventFromGoogleIfNeeded.mockResolvedValue(undefined);
  createNotification.mockResolvedValue({ id: "n1" });
  hasPagePermission.mockResolvedValue(true);
  isStatusApproved.mockResolvedValue(true);
  svc.isStorageOverQuota.mockResolvedValue(false);
  svc.storeProjectPhoto.mockResolvedValue("https://storage/foto.webp");
  svc.createProjectShareLink.mockResolvedValue({ url: "https://erp/share/project/tok", sharedProjectId: "sp1" });
  svc.saveProjectSettings.mockResolvedValue({ onApproval: "never", stageTemplate: [] });
  projects = {
    p1: { tenantId: "t1", title: "Casa", stages: [stage()], delivery: { status: "none" } },
    outro: { tenantId: "t2", title: "Outra empresa", stages: [stage()] },
  };
  docs = {
    users: { u1: { name: "Ana" }, tec: { tenantId: "t1", name: "Carlos Técnico" }, fora: { tenantId: "t2", name: "X" } },
    proposals: { prop1: { tenantId: "t1", title: "Casa" }, propFora: { tenantId: "t2" } },
    clients: {},
  };
});

describe("permissão e isolamento", () => {
  it("sem a permissão de Projetos: 403 em toda escrita", async () => {
    hasPagePermission.mockResolvedValue(false);
    for (const [handler, req] of [
      [createProject, fakeReq({}, { title: "Obra" })],
      [updateProject, fakeReq({ id: "p1" }, { title: "Nova" })],
      [deleteProject, fakeReq({ id: "p1" })],
      [updateStage, fakeReq({ id: "p1", stageId: "s1" }, { status: "done" })],
    ] as const) {
      const res = fakeRes();
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    }
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "projects", "canCreate");
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "projects", "canDelete");
    expect(projectUpdates).toHaveLength(0);
  });

  it("projeto de outra empresa: 404", async () => {
    const res = fakeRes();
    await updateStage(fakeReq({ id: "outro", stageId: "s1" }, { status: "done" }), res);
    expect(res.statusCode).toBe(404);
    const res2 = fakeRes();
    await updateProject(fakeReq({ id: "outro" }, { title: "Invadir" }), res2);
    expect(res2.statusCode).toBe(404);
  });
});

describe("createProject", () => {
  it("a partir da proposta da empresa: idempotente, 201 quando cria e 200 quando já existia", async () => {
    svc.createProjectFromProposal.mockResolvedValueOnce({ projectId: "proposal_prop1", created: true });
    const res = fakeRes();
    await createProject(fakeReq({}, { proposalId: "prop1" }), res);
    expect(res.statusCode).toBe(201);

    svc.createProjectFromProposal.mockResolvedValueOnce({ projectId: "proposal_prop1", created: false });
    const again = fakeRes();
    await createProject(fakeReq({}, { proposalId: "prop1" }), again);
    expect(again.statusCode).toBe(200);
  });

  it("proposta ainda não aprovada: 409, nada criado", async () => {
    isStatusApproved.mockResolvedValue(false);
    const res = fakeRes();
    await createProject(fakeReq({}, { proposalId: "prop1" }), res);
    expect(res.statusCode).toBe(409);
    expect(svc.createProjectFromProposal).not.toHaveBeenCalled();
  });

  it("proposta de outra empresa: 404, nada criado", async () => {
    const res = fakeRes();
    await createProject(fakeReq({}, { proposalId: "propFora" }), res);
    expect(res.statusCode).toBe(404);
    expect(svc.createProjectFromProposal).not.toHaveBeenCalled();
  });
});

describe("updateProject", () => {
  it("técnico da equipe entra com o nome", async () => {
    const res = fakeRes();
    await updateProject(fakeReq({ id: "p1" }, { assigneeId: "tec" }), res);
    expect(res.statusCode).toBe(200);
    expect(projects.p1).toMatchObject({ assigneeId: "tec", assigneeName: "Carlos Técnico" });
  });

  it("técnico de outra empresa é recusado", async () => {
    const res = fakeRes();
    await updateProject(fakeReq({ id: "p1" }, { assigneeId: "fora" }), res);
    expect(res.statusCode).toBe(400);
    expect(projects.p1.assigneeId).toBeUndefined();
  });

  it("tirar o responsável limpa nome e id", async () => {
    projects.p1.assigneeId = "tec";
    projects.p1.assigneeName = "Carlos";
    const res = fakeRes();
    await updateProject(fakeReq({ id: "p1" }, { assigneeId: null }), res);
    expect(projects.p1).toMatchObject({ assigneeId: null, assigneeName: null });
  });
});

describe("etapas e checklist", () => {
  it("marcar o primeiro item põe a etapa pendente em andamento", async () => {
    const res = fakeRes();
    await toggleChecklistItem(fakeReq({ id: "p1", stageId: "s1", itemId: "i1" }, { done: true }), res);
    expect(res.statusCode).toBe(200);
    const saved = (projects.p1.stages as Array<Record<string, unknown>>)[0];
    expect(saved.status).toBe("in_progress");
    expect((saved.checklist as Array<Record<string, unknown>>)[0]).toMatchObject({ done: true, doneBy: "u1" });
  });

  it("concluir a etapa grava a data", async () => {
    const res = fakeRes();
    await updateStage(fakeReq({ id: "p1", stageId: "s1" }, { status: "done" }), res);
    const saved = (projects.p1.stages as Array<Record<string, unknown>>)[0];
    expect(saved.status).toBe("done");
    expect(typeof saved.completedAt).toBe("string");
  });

  it("incluir item novo e etapa inexistente dá 404", async () => {
    const res = fakeRes();
    await addChecklistItem(fakeReq({ id: "p1", stageId: "s1" }, { text: "Testar controle" }), res);
    expect(res.statusCode).toBe(201);
    expect((projects.p1.stages as Array<{ checklist: unknown[] }>)[0].checklist).toHaveLength(2);

    const missing = fakeRes();
    await addChecklistItem(fakeReq({ id: "p1", stageId: "nao" }, { text: "x" }), missing);
    expect(missing.statusCode).toBe(404);
  });
});

describe("uploadStagePhoto", () => {
  it("guarda no caminho da empresa e anexa à etapa com o autor", async () => {
    const res = fakeRes();
    await uploadStagePhoto(fakeReq({ id: "p1", stageId: "s1" }, { dataUrl: TINY_WEBP, caption: "Quadro" }), res);
    expect(res.statusCode).toBe(201);
    const path = svc.storeProjectPhoto.mock.calls[0][0].path as string;
    expect(path).toMatch(/^tenants\/t1\/projects\/p1\/s1\/.+\.webp$/);
    const photos = (projects.p1.stages as Array<{ photos: Array<Record<string, unknown>> }>)[0].photos;
    expect(photos[0]).toMatchObject({ caption: "Quadro", uploadedBy: "u1", uploadedByName: "Ana" });
  });

  it("arquivo que não é imagem é recusado sem subir nada", async () => {
    const res = fakeRes();
    await uploadStagePhoto(
      fakeReq({ id: "p1", stageId: "s1" }, { dataUrl: "data:application/pdf;base64,AAAA" }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(svc.storeProjectPhoto).not.toHaveBeenCalled();
  });

  it("armazenamento do plano cheio: 402 sem subir", async () => {
    svc.isStorageOverQuota.mockResolvedValue(true);
    const res = fakeRes();
    await uploadStagePhoto(fakeReq({ id: "p1", stageId: "s1" }, { dataUrl: TINY_WEBP }), res);
    expect(res.statusCode).toBe(402);
    expect(res.body.code).toBe("STORAGE_QUOTA_EXCEEDED");
    expect(svc.storeProjectPhoto).not.toHaveBeenCalled();
  });
});

describe("deleteProject", () => {
  it("apaga o projeto e as fotos no Storage", async () => {
    projects.p1.stages = [stage({ photos: [{ id: "f1", storagePath: "tenants/t1/projects/p1/s1/f1.webp" }] })];
    const res = fakeRes();
    await deleteProject(fakeReq({ id: "p1" }), res);
    expect(projectDeletes).toEqual(["p1"]);
    expect(svc.deleteProjectPhotos).toHaveBeenCalledWith(["tenants/t1/projects/p1/s1/f1.webp"]);
  });
});

describe("createDeliveryLink", () => {
  it("gera o link e marca a entrega como enviada", async () => {
    const res = fakeRes();
    await createDeliveryLink(fakeReq({ id: "p1" }), res);
    expect(res.body).toEqual({ url: "https://erp/share/project/tok" });
    expect(projects.p1).toMatchObject({ "delivery.status": "sent", "delivery.sharedProjectId": "sp1" });
  });

  it("entrega já aceita: 409", async () => {
    projects.p1.delivery = { status: "accepted" };
    const res = fakeRes();
    await createDeliveryLink(fakeReq({ id: "p1" }), res);
    expect(res.statusCode).toBe(409);
  });
});

describe("listProjectAssignees", () => {
  it("lista só a equipe da empresa, em ordem alfabética", async () => {
    docs.users.zeca = { tenantId: "t1", name: "Zeca" };
    docs.users.bia = { tenantId: "t1", name: "Bia" };
    const res = fakeRes();
    await listProjectAssignees(fakeReq(), res);
    expect(res.body.assignees).toEqual([
      { id: "bia", name: "Bia" },
      { id: "tec", name: "Carlos Técnico" },
      { id: "zeca", name: "Zeca" },
    ]);
  });

  it("sem permissão de ver Projetos: 403", async () => {
    hasPagePermission.mockResolvedValue(false);
    const res = fakeRes();
    await listProjectAssignees(fakeReq(), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("updateProjectSettings", () => {
  it("só o administrador da empresa altera", async () => {
    const member = fakeRes();
    await updateProjectSettings(fakeReq({}, { onApproval: "never" }, "MEMBER"), member);
    expect(member.statusCode).toBe(403);
    expect(svc.saveProjectSettings).not.toHaveBeenCalled();

    const master = fakeRes();
    await updateProjectSettings(fakeReq({}, { onApproval: "never" }, "master"), master);
    expect(master.statusCode).toBe(200);
    expect(svc.saveProjectSettings).toHaveBeenCalledWith("t1", { onApproval: "never" }, "u1");
  });

  it("roteiro sem etapa nenhuma é recusado", async () => {
    const res = fakeRes();
    await updateProjectSettings(fakeReq({}, { stageTemplate: [] }, "MASTER"), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("agendar a etapa", () => {
  const visit = { isAllDay: false, startsAt: "2026-10-20T11:00:00.000Z", endsAt: "2026-10-20T14:00:00.000Z" };

  beforeEach(() => {
    projects.p1 = {
      ...projects.p1,
      address: "Rua X, 123",
      clientName: "Ana Ribeiro",
      assigneeId: "tec",
      assigneeName: "Carlos Técnico",
    };
  });

  it("cria o evento da Agenda ligado à obra e à etapa, e espelha a data na etapa", async () => {
    const res = fakeRes();
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, visit), res);

    expect(res.statusCode).toBe(200);
    const event = docSets.find((w) => w.collection === "calendar_events");
    expect(event?.data).toMatchObject({
      tenantId: "t1",
      title: "Instalação: Casa",
      location: "Rua X, 123",
      status: "scheduled",
      projectId: "p1",
      projectStageId: "s1",
      startsAt: visit.startsAt,
      endsAt: visit.endsAt,
      googleSync,
    });
    expect(String(event?.data.description)).toContain("https://erp.test/projects/p1");
    const stages = projects.p1.stages as Array<Record<string, unknown>>;
    expect(stages[0].schedule).toMatchObject({ eventId: event?.id, startsAt: visit.startsAt });
    expect(res.body.schedule).toMatchObject({ eventId: event?.id });
  });

  it("avisa o técnico da obra quando outra pessoa marca", async () => {
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, visit), fakeRes());
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        type: "project_visit_scheduled",
        title: "Visita agendada",
        projectId: "p1",
        targetUids: ["tec"],
      }),
    );
  });

  it("o próprio técnico marcando não avisa a si mesmo", async () => {
    projects.p1.assigneeId = "u1";
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, visit), fakeRes());
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("remarcar reaproveita o mesmo evento; o aviso só sai se a data mudou", async () => {
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, visit), fakeRes());
    const firstId = docSets[0].id;
    createNotification.mockClear();

    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, visit), fakeRes());
    expect(docSets[1].id).toBe(firstId);
    expect(createNotification).not.toHaveBeenCalled();

    const later = { ...visit, startsAt: "2026-10-21T11:00:00.000Z", endsAt: "2026-10-21T14:00:00.000Z" };
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, later), fakeRes());
    expect(docSets[2].id).toBe(firstId);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ title: "Visita remarcada" }));
  });

  it("dia inteiro também vale", async () => {
    const res = fakeRes();
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, { isAllDay: true, startDate: "2026-10-20" }), res);
    expect(res.statusCode).toBe(200);
    expect(docSets[0].data).toMatchObject({ isAllDay: true, startDate: "2026-10-20", endDate: "2026-10-21" });
  });

  it("fim antes do início: 400 sem gravar nada", async () => {
    const res = fakeRes();
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, { ...visit, endsAt: "2026-10-20T10:00:00.000Z" }), res);
    expect(res.statusCode).toBe(400);
    expect(docSets).toHaveLength(0);
    expect(projectUpdates).toHaveLength(0);
  });

  it("sem editar Projetos: 403; obra de outra empresa: 404; etapa que não existe: 404", async () => {
    hasPagePermission.mockResolvedValueOnce(false);
    const denied = fakeRes();
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, visit), denied);
    expect(denied.statusCode).toBe(403);
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "projects", "canEdit");

    const other = fakeRes();
    await scheduleStage(fakeReq({ id: "outro", stageId: "s1" }, visit), other);
    expect(other.statusCode).toBe(404);

    const missing = fakeRes();
    await scheduleStage(fakeReq({ id: "p1", stageId: "nada" }, visit), missing);
    expect(missing.statusCode).toBe(404);
    expect(docSets).toHaveLength(0);
  });

  it("não aceita vínculo vindo do corpo da requisição", async () => {
    const res = fakeRes();
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, { ...visit, projectId: "outro" }), res);
    expect(res.statusCode).toBe(400);
    expect(docSets).toHaveLength(0);
  });

  it("desmarcar tira a data da etapa e apaga o evento (e a cópia no Google)", async () => {
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, visit), fakeRes());
    const eventId = docSets[0].id;

    const res = fakeRes();
    await unscheduleStage(fakeReq({ id: "p1", stageId: "s1" }), res);
    expect(res.statusCode).toBe(200);
    expect((projects.p1.stages as Array<Record<string, unknown>>)[0].schedule).toBeNull();
    expect(docDeletes).toContainEqual({ collection: "calendar_events", id: eventId });
    expect(deleteEventFromGoogleIfNeeded).toHaveBeenCalledTimes(1);
  });

  it("excluir a obra apaga as visitas dela na Agenda", async () => {
    await scheduleStage(fakeReq({ id: "p1", stageId: "s1" }, visit), fakeRes());
    const eventId = docSets[0].id;
    await deleteProject(fakeReq({ id: "p1" }), fakeRes());
    expect(docDeletes).toContainEqual({ collection: "calendar_events", id: eventId });
  });
});
