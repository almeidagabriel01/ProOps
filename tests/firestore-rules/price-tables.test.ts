import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Tabelas de preço (`price_tables`): leitura por quem é da empresa com a
 * assinatura liberada, leitura do tenant de demonstração por qualquer conta
 * logada, e escrita só pelo backend (que aplica a permissão de Produtos e o
 * plano). As rules não conhecem plano.
 */

let testEnv: RulesTestEnvironment;
const ALPHA = "tenant-alpha";
const BETA = "tenant-beta";
const DEMO = "demo";

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
    await setDoc(doc(db, "users", "uid-free"), { tenantId: "tenant-free", role: "free" });
    await setDoc(doc(db, "price_tables", "alpha-vip"), {
      tenantId: ALPHA,
      name: "VIP",
      adjustmentPercent: -10,
      productPrices: {},
    });
    await setDoc(doc(db, "price_tables", "beta-vip"), {
      tenantId: BETA,
      name: "VIP",
      adjustmentPercent: 5,
      productPrices: {},
    });
    await setDoc(doc(db, "price_tables", "demo-vip"), {
      tenantId: DEMO,
      name: "Exemplo",
      adjustmentPercent: -8,
      productPrices: {},
    });
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

function masterAlpha() {
  return testEnv
    .authenticatedContext("master-alpha", {
      role: "MASTER",
      tenantId: ALPHA,
      subscriptionStatus: "active",
    })
    .firestore();
}

function freeDb() {
  return testEnv
    .authenticatedContext("uid-free", {
      tenantId: "tenant-free",
      role: "free",
      subscriptionStatus: "free",
    })
    .firestore();
}

describe("price_tables", () => {
  it("membro da empresa lê a tabela dela", async () => {
    await assertSucceeds(getDoc(doc(memberAlpha(), "price_tables", "alpha-vip")));
  });

  it("não lê tabela de outra empresa", async () => {
    await assertFails(getDoc(doc(memberAlpha(), "price_tables", "beta-vip")));
  });

  it("não autenticado não lê", async () => {
    await assertFails(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), "price_tables", "alpha-vip")),
    );
  });

  it("a conta free lê a tabela de demonstração e nenhuma tabela real", async () => {
    await assertSucceeds(getDoc(doc(freeDb(), "price_tables", "demo-vip")));
    await assertFails(getDoc(doc(freeDb(), "price_tables", "alpha-vip")));
  });

  it("ninguém grava pelo navegador, nem o dono: só o backend", async () => {
    for (const db of [memberAlpha(), masterAlpha()]) {
      await assertFails(
        setDoc(doc(db, "price_tables", "nova"), { tenantId: ALPHA, name: "X", adjustmentPercent: 0 }),
      );
      await assertFails(updateDoc(doc(db, "price_tables", "alpha-vip"), { adjustmentPercent: -50 }));
      await assertFails(deleteDoc(doc(db, "price_tables", "alpha-vip")));
    }
    await assertFails(updateDoc(doc(freeDb(), "price_tables", "demo-vip"), { name: "Y" }));
  });
});
