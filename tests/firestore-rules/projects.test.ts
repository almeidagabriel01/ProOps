import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Projetos de instalação (Onda 3). `projects` segue a política das demais
 * coleções do tenant: lê quem é da empresa (e a conta de demonstração, o
 * tenant "demo"), escreve só o backend. `project_settings` e `shared_projects`
 * não são lidos pelo cliente em hipótese nenhuma: a configuração vem pela API
 * e o link público é resolvido no backend pelo token.
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
    await setDoc(doc(db, "projects", "alpha-1"), { tenantId: ALPHA, title: "Casa" });
    await setDoc(doc(db, "projects", "beta-1"), { tenantId: BETA, title: "Outra" });
    await setDoc(doc(db, "projects", "demo-1"), { tenantId: "demo", title: "Exemplo" });
    await setDoc(doc(db, "project_settings", ALPHA), { tenantId: ALPHA, autoCreateOnApproval: true });
    await setDoc(doc(db, "shared_projects", "sp1"), { tenantId: ALPHA, projectId: "alpha-1", token: "tok" });
  });
});

function ctx(role: string, tenantId: string, uid = `${role}-${tenantId}`) {
  return testEnv
    .authenticatedContext(uid, { role, tenantId, masterId: "master-alpha", subscriptionStatus: "active" })
    .firestore();
}

describe("projects", () => {
  it("membro da empresa lê o projeto dela", async () => {
    await assertSucceeds(getDoc(doc(ctx("MEMBER", ALPHA), "projects", "alpha-1")));
  });

  it("não lê projeto de outra empresa", async () => {
    await assertFails(getDoc(doc(ctx("MEMBER", ALPHA), "projects", "beta-1")));
  });

  it("conta de demonstração lê o projeto de exemplo", async () => {
    await assertSucceeds(getDoc(doc(ctx("free", "tenant_free1"), "projects", "demo-1")));
  });

  it("não autenticado não lê", async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "projects", "alpha-1")));
  });

  it("ninguém grava pelo cliente, nem o master", async () => {
    await assertFails(setDoc(doc(ctx("MASTER", ALPHA), "projects", "novo"), { tenantId: ALPHA }));
    await assertFails(deleteDoc(doc(ctx("MASTER", ALPHA), "projects", "alpha-1")));
  });
});

describe.each(["project_settings", "shared_projects"])("%s", (name) => {
  const id = name === "project_settings" ? ALPHA : "sp1";

  it("nem o master da própria empresa lê pelo cliente", async () => {
    await assertFails(getDoc(doc(ctx("MASTER", ALPHA), name, id)));
  });

  it("ninguém grava pelo cliente", async () => {
    await assertFails(setDoc(doc(ctx("MASTER", ALPHA), name, "x"), { tenantId: ALPHA }));
  });
});
