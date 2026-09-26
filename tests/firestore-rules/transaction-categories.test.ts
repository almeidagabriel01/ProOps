import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Categorias de lançamento (com o grupo do DRE): um doc por empresa, lido e
 * gravado só pela API, com a permissão de Lançamentos. Pelo SDK, ninguém.
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
    await setDoc(doc(db, "transaction_categories", DOC), {
      tenantId: ALPHA,
      items: [{ id: "c1", name: "Vendas", kind: "income", group: "revenue" }],
    });
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

describe("transaction_categories", () => {
  it("nem o dono lê pelo SDK", async () => {
    await assertFails(getDoc(doc(master(), "transaction_categories", DOC)));
  });

  it("membro não lê", async () => {
    await assertFails(getDoc(doc(member(), "transaction_categories", DOC)));
  });

  it("anônimo não lê", async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "transaction_categories", DOC)));
  });

  it("ninguém grava pelo SDK", async () => {
    await assertFails(setDoc(doc(master(), "transaction_categories", DOC), { tenantId: ALPHA, items: [] }));
    await assertFails(setDoc(doc(member(), "transaction_categories", DOC), { tenantId: ALPHA, items: [] }));
  });
});
