import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Link do contador: o token abre o financeiro e as notas da empresa sem login.
 * Pelo SDK ninguém lê nem grava, nem o dono.
 */

let testEnv: RulesTestEnvironment;
const ALPHA = "tenant-alpha";
const DOC = ALPHA;

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
    await setDoc(doc(db, "users", "dono"), { tenantId: ALPHA, role: "MASTER" });
    await setDoc(doc(db, "users", "membro"), { tenantId: ALPHA, role: "MEMBER", masterId: "dono" });
    await setDoc(doc(db, "accountant_links", DOC), { tenantId: ALPHA, token: "segredo-do-contador-123" });
  });
});

function master() {
  return testEnv
    .authenticatedContext("dono", { role: "MASTER", tenantId: ALPHA, subscriptionStatus: "active" })
    .firestore();
}

function member() {
  return testEnv
    .authenticatedContext("membro", { role: "MEMBER", tenantId: ALPHA, masterId: "dono" })
    .firestore();
}

describe("accountant_links", () => {
  it("nem o dono lê pelo SDK", async () => {
    await assertFails(getDoc(doc(master(), "accountant_links", DOC)));
  });

  it("membro não lê", async () => {
    await assertFails(getDoc(doc(member(), "accountant_links", DOC)));
  });

  it("anônimo não acha o link pelo token", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "accountant_links", DOC)));
    await assertFails(getDocs(query(collection(anon, "accountant_links"), where("token", "==", "segredo-do-contador-123"))));
  });

  it("ninguém grava pelo SDK", async () => {
    await assertFails(setDoc(doc(master(), "accountant_links", DOC), { tenantId: ALPHA, token: "meu" }));
    await assertFails(setDoc(doc(member(), "accountant_links", DOC), { tenantId: ALPHA, token: "meu" }));
  });
});
