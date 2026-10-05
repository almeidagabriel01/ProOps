import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * A proposta carrega os valores da venda. A regra deixava QUALQUER membro da
 * empresa lê-la pelo SDK, sem olhar a permissão de página: o técnico de campo
 * (preset "technician": só OS, equipamentos e agenda), que a tela não deixa
 * abrir Propostas, lia todos os preços direto do navegador.
 *
 * Agora o membro precisa de "Ver" (users/{uid}/permissions/{pageId}.canView)
 * em Propostas ou no CRM (`kanban`, o quadro que mostra cada proposta com o
 * valor). Dono e administradores leem tudo; o superadmin com MFA e a conta
 * free lendo o tenant de demonstração seguem como antes.
 */

let testEnv: RulesTestEnvironment;
const ALPHA = "tenant-alpha";
const BETA = "tenant-beta";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-proops-test",
    firestore: {
      rules: readFileSync(path.resolve(__dirname, "../../firebase/firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

async function seedMember(uid: string, pages: Record<string, Record<string, boolean>>) {
  await seed(`users/${uid}`, { tenantId: ALPHA, role: "MEMBER", masterId: "master-alpha" });
  for (const [pageId, flags] of Object.entries(pages)) {
    await seed(`users/${uid}/permissions/${pageId}`, flags);
  }
}

function memberDb(uid: string, tenantId = ALPHA) {
  return testEnv
    .authenticatedContext(uid, {
      role: "MEMBER",
      tenantId,
      masterId: "master-alpha",
      subscriptionStatus: "active",
    })
    .firestore();
}

function proposalsQuery(db: ReturnType<typeof memberDb>, tenantId = ALPHA) {
  return query(collection(db, "proposals"), where("tenantId", "==", tenantId), limit(10));
}

const TECHNICIAN = {
  service_orders: { canView: true, canCreate: false, canEdit: true, canDelete: false },
  equipment: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  calendar: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  proposals: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  kanban: { canView: false, canCreate: false, canEdit: false, canDelete: false },
};

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(`tenants/${ALPHA}`, { name: "Alpha", subscriptionStatus: "active" });
  await seed(`tenants/${BETA}`, { name: "Beta", subscriptionStatus: "active" });
  await seed("users/master-alpha", { tenantId: ALPHA, role: "MASTER" });
  await seed("proposals/alpha-1", { tenantId: ALPHA, title: "Casa", totalValue: 18500 });
  await seed("proposals/beta-1", { tenantId: BETA, title: "Outra", totalValue: 9000 });
  await seed("proposals/demo-1", { tenantId: "demo", title: "Exemplo", totalValue: 1000 });
});

describe("proposals: membro precisa de permissão", () => {
  it("técnico (sem propostas nem CRM) não lê a proposta", async () => {
    await seedMember("tec", TECHNICIAN);
    await assertFails(getDoc(doc(memberDb("tec"), "proposals", "alpha-1")));
  });

  it("técnico não lista as propostas da empresa", async () => {
    await seedMember("tec", TECHNICIAN);
    await assertFails(getDocs(proposalsQuery(memberDb("tec"))));
  });

  it("membro sem doc de permissão nenhum não lê", async () => {
    await seedMember("vazio", {});
    await assertFails(getDoc(doc(memberDb("vazio"), "proposals", "alpha-1")));
  });

  it("membro com propostas só criando/editando, sem 'Ver', não lê", async () => {
    await seedMember("sem-ver", { proposals: { canView: false, canEdit: true } });
    await assertFails(getDoc(doc(memberDb("sem-ver"), "proposals", "alpha-1")));
  });

  it("membro com 'Ver' em propostas lê e lista", async () => {
    await seedMember("vend", { proposals: { canView: true } });
    await assertSucceeds(getDoc(doc(memberDb("vend"), "proposals", "alpha-1")));
    await assertSucceeds(getDocs(proposalsQuery(memberDb("vend"))));
  });

  it("membro só com o CRM (kanban) lê e lista: o quadro mostra a proposta", async () => {
    await seedMember("crm", { kanban: { canView: true } });
    await assertSucceeds(getDoc(doc(memberDb("crm"), "proposals", "alpha-1")));
    await assertSucceeds(getDocs(proposalsQuery(memberDb("crm"))));
  });

  it("membro com outras telas (contatos, produtos, projetos, dashboard) não lê", async () => {
    await seedMember("outros", {
      clients: { canView: true },
      products: { canView: true },
      services: { canView: true },
      projects: { canView: true },
      dashboard: { canView: true },
      transactions: { canView: true },
    });
    await assertFails(getDoc(doc(memberDb("outros"), "proposals", "alpha-1")));
  });

  it("membro com permissão não lê proposta de outra empresa", async () => {
    await seedMember("vend", { proposals: { canView: true } });
    await assertFails(getDoc(doc(memberDb("vend"), "proposals", "beta-1")));
    await assertFails(getDocs(proposalsQuery(memberDb("vend"), BETA)));
  });

  it("a permissão é de cada membro: a de um não vale para o outro", async () => {
    await seedMember("vend", { proposals: { canView: true } });
    await seedMember("tec", TECHNICIAN);
    await assertSucceeds(getDoc(doc(memberDb("vend"), "proposals", "alpha-1")));
    await assertFails(getDoc(doc(memberDb("tec"), "proposals", "alpha-1")));
  });
});

describe("proposals: dono, administradores, superadmin e demonstração", () => {
  it.each(["MASTER", "ADMIN", "WK", "master", "admin"])("%s lê sem doc de permissão", async (role) => {
    await seed("users/chefe", { tenantId: ALPHA, role });
    const db = testEnv
      .authenticatedContext("chefe", { role, tenantId: ALPHA, subscriptionStatus: "active" })
      .firestore();
    await assertSucceeds(getDoc(doc(db, "proposals", "alpha-1")));
    await assertSucceeds(getDocs(proposalsQuery(db)));
  });

  it("dono com claim de papel ausente cai no doc do usuário e lê", async () => {
    await seed("users/master-alpha", { tenantId: ALPHA, role: "MASTER" });
    const db = testEnv
      .authenticatedContext("master-alpha", { tenantId: ALPHA, subscriptionStatus: "active" })
      .firestore();
    await assertSucceeds(getDoc(doc(db, "proposals", "alpha-1")));
  });

  it("dono não lê proposta de outra empresa", async () => {
    const db = testEnv
      .authenticatedContext("master-alpha", { role: "MASTER", tenantId: ALPHA, subscriptionStatus: "active" })
      .firestore();
    await assertFails(getDoc(doc(db, "proposals", "beta-1")));
  });

  it("superadmin com MFA lê de qualquer empresa", async () => {
    await seed("users/sa", { role: "SUPERADMIN", tenantId: "" });
    const db = testEnv
      .authenticatedContext("sa", {
        role: "SUPERADMIN",
        firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" },
      })
      .firestore();
    await assertSucceeds(getDoc(doc(db, "proposals", "beta-1")));
  });

  it("conta free lê a proposta de demonstração, sem permissão de página", async () => {
    await seed("users/free1", { tenantId: "tenant_free1", role: "free" });
    const db = testEnv
      .authenticatedContext("free1", { role: "free", tenantId: "tenant_free1", subscriptionStatus: "free" })
      .firestore();
    await assertSucceeds(getDoc(doc(db, "proposals", "demo-1")));
    await assertFails(getDoc(doc(db, "proposals", "alpha-1")));
  });

  it("técnico também lê a demonstração (dado público de exemplo)", async () => {
    await seedMember("tec", TECHNICIAN);
    await assertSucceeds(getDoc(doc(memberDb("tec"), "proposals", "demo-1")));
  });

  it("ninguém grava pelo cliente", async () => {
    await seedMember("vend", { proposals: { canView: true, canCreate: true, canEdit: true } });
    await assertFails(setDoc(doc(memberDb("vend"), "proposals", "nova"), { tenantId: ALPHA }));
  });
});
