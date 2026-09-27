import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Portal do cliente: o token abre, sem login, as propostas, os pagamentos e a
 * obra do contato. Ninguém lê nem grava o link pelo SDK, nem a própria
 * empresa: tudo passa pela API, com a permissão de Contatos.
 */

let testEnv: RulesTestEnvironment;
const ALPHA = "tenant-alpha";
const LINK = `${ALPHA}_cliente1`;

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
    await setDoc(doc(db, "client_portal_links", LINK), {
      tenantId: ALPHA,
      clientId: "cliente1",
      token: "segredo-do-portal-123",
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

describe("client_portal_links", () => {
  it("nem o dono lê o link pelo SDK", async () => {
    await assertFails(getDoc(doc(master(), "client_portal_links", LINK)));
  });

  it("membro não lê", async () => {
    await assertFails(getDoc(doc(member(), "client_portal_links", LINK)));
  });

  it("anônimo não acha o link pelo token", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDocs(query(collection(anon, "client_portal_links"), where("token", "==", "segredo-do-portal-123"))),
    );
  });

  it("ninguém grava pelo SDK", async () => {
    await assertFails(setDoc(doc(master(), "client_portal_links", `${ALPHA}_outro`), { tenantId: ALPHA }));
    await assertFails(setDoc(doc(member(), "client_portal_links", LINK), { tenantId: ALPHA, token: "meu" }));
  });
});
