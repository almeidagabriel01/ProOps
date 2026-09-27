import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Tarefas: da pessoa. Lê quem criou, o responsável e quem foi citado
 * (`audienceUids`); o dono lê todas; ninguém grava pelo cliente.
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

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants", ALPHA), { name: "Alpha", subscriptionStatus: "active" });
    await setDoc(doc(db, "tenants", BETA), { name: "Beta", subscriptionStatus: "active" });
    await setDoc(doc(db, "users", "dono"), { tenantId: ALPHA, role: "MASTER" });
    await setDoc(doc(db, "users", "ana"), { tenantId: ALPHA, role: "MEMBER" });
    await setDoc(doc(db, "users", "beto"), { tenantId: ALPHA, role: "MEMBER" });
    await setDoc(doc(db, "tasks", "da-ana"), {
      tenantId: ALPHA,
      title: "Ligar",
      audienceUids: ["ana"],
      createdAt: "2026-09-26T10:00:00.000Z",
    });
    await setDoc(doc(db, "tasks", "da-ana-para-beto"), {
      tenantId: ALPHA,
      title: "Medir",
      audienceUids: ["ana", "beto"],
      createdAt: "2026-09-26T11:00:00.000Z",
    });
    await setDoc(doc(db, "tasks", "outra-empresa"), {
      tenantId: BETA,
      title: "Outra",
      audienceUids: ["ana"],
      createdAt: "2026-09-26T11:00:00.000Z",
    });
    await setDoc(doc(db, "tasks", "demo-1"), {
      tenantId: "demo",
      title: "Exemplo",
      audienceUids: [],
      createdAt: "2026-09-26T11:00:00.000Z",
    });
  });
});

function ctx(uid: string, role = "MEMBER", tenantId = ALPHA) {
  return testEnv
    .authenticatedContext(uid, { role, tenantId, masterId: "dono", subscriptionStatus: "active" })
    .firestore();
}

describe("tasks", () => {
  it("quem está na tarefa lê", async () => {
    await assertSucceeds(getDoc(doc(ctx("beto"), "tasks", "da-ana-para-beto")));
  });

  it("membro da mesma empresa que não está na tarefa não lê", async () => {
    await assertFails(getDoc(doc(ctx("beto"), "tasks", "da-ana")));
  });

  it("o dono lê todas, inclusive pela lista da empresa", async () => {
    await assertSucceeds(getDoc(doc(ctx("dono", "MASTER"), "tasks", "da-ana")));
    const snap = await assertSucceeds(
      getDocs(
        query(
          collection(ctx("dono", "MASTER"), "tasks"),
          where("tenantId", "==", ALPHA),
          orderBy("createdAt", "desc"),
          limit(300),
        ),
      ),
    );
    expect(snap.size).toBe(2);
  });

  it("a lista do membro passa filtrando por ele e devolve só as dele", async () => {
    const snap = await assertSucceeds(
      getDocs(
        query(
          collection(ctx("beto"), "tasks"),
          where("tenantId", "==", ALPHA),
          where("audienceUids", "array-contains", "beto"),
          orderBy("createdAt", "desc"),
          limit(300),
        ),
      ),
    );
    expect(snap.docs.map((d) => d.id)).toEqual(["da-ana-para-beto"]);
  });

  it("a lista da empresa inteira é recusada para o membro", async () => {
    await assertFails(
      getDocs(query(collection(ctx("beto"), "tasks"), where("tenantId", "==", ALPHA), limit(300))),
    );
  });

  it("não lê tarefa de outra empresa, mesmo citado nela", async () => {
    await assertFails(getDoc(doc(ctx("ana"), "tasks", "outra-empresa")));
  });

  it("conta free lê as tarefas de demonstração", async () => {
    await assertSucceeds(getDoc(doc(ctx("free-1", "free", "tenant_free1"), "tasks", "demo-1")));
  });

  it("ninguém grava pelo cliente, nem o dono", async () => {
    await assertFails(setDoc(doc(ctx("dono", "MASTER"), "tasks", "nova"), { tenantId: ALPHA }));
    await assertFails(deleteDoc(doc(ctx("ana"), "tasks", "da-ana")));
  });
});
