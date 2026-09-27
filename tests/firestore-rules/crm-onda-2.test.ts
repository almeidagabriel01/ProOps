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
 * Coleções da Onda 2 (ficha 360 e CRM). Mesma política das demais do tenant:
 * leitura por quem é da empresa com assinatura liberada, escrita só pelo
 * backend, que aplica a permissão de membro e o plano.
 */

let testEnv: RulesTestEnvironment;
const ALPHA = "tenant-alpha";
const BETA = "tenant-beta";
const COLLECTIONS = ["client_notes", "leads", "activities"];

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-proops-test",
    firestore: {
      rules: readFileSync(
        path.resolve(__dirname, "../../firebase/firestore.rules"),
        "utf8",
      ),
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
    for (const name of COLLECTIONS) {
      await setDoc(doc(db, name, "alpha-1"), { tenantId: ALPHA, text: "a" });
      await setDoc(doc(db, name, "beta-1"), { tenantId: BETA, text: "b" });
    }
  });
});

function memberAlpha() {
  return testEnv
    .authenticatedContext("member-alpha", {
      role: "MEMBER",
      tenantId: ALPHA,
      masterId: "master-alpha",
      subscriptionStatus: "active",
    })
    .firestore();
}

describe.each(COLLECTIONS)("%s", (name) => {
  it("membro da empresa lê o documento dela", async () => {
    await assertSucceeds(getDoc(doc(memberAlpha(), name, "alpha-1")));
  });

  it("não lê documento de outra empresa", async () => {
    await assertFails(getDoc(doc(memberAlpha(), name, "beta-1")));
  });

  it("não autenticado não lê", async () => {
    await assertFails(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), name, "alpha-1")),
    );
  });

  it("cliente não grava nem apaga: só o backend", async () => {
    await assertFails(
      setDoc(doc(memberAlpha(), name, "novo"), { tenantId: ALPHA, text: "x" }),
    );
    await assertFails(deleteDoc(doc(memberAlpha(), name, "alpha-1")));
  });
});
