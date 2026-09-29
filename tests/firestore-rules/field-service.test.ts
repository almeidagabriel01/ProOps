import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Assistência técnica. A OS é do técnico: ele lê as atribuídas a ele; o dono,
 * os administradores e o membro com o escopo `service_orders_all` leem todas.
 * Equipamentos e histórico de estoque são da empresa inteira. Nada é gravado
 * pelo cliente, e o contador da numeração nem é lido.
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
    await setDoc(doc(db, "users", "coordenadora"), { tenantId: ALPHA, role: "MEMBER" });
    await setDoc(doc(db, "users", "coordenadora", "permissions", "service_orders_all"), { canView: true });
    await setDoc(doc(db, "users", "sem-escopo"), { tenantId: ALPHA, role: "MEMBER" });
    await setDoc(doc(db, "users", "sem-escopo", "permissions", "service_orders_all"), { canView: false });
    await setDoc(doc(db, "service_orders", "do-diego"), { tenantId: ALPHA, technicianUids: ["diego"] });
    await setDoc(doc(db, "service_orders", "da-lia"), { tenantId: ALPHA, technicianUids: ["lia"] });
    await setDoc(doc(db, "service_orders", "sem-tecnico"), { tenantId: ALPHA, technicianUids: [] });
    await setDoc(doc(db, "service_orders", "outra-empresa"), { tenantId: BETA, technicianUids: ["diego"] });
    await setDoc(doc(db, "service_orders", "demo-1"), { tenantId: "demo-climatizacao", technicianUids: [] });
    await setDoc(doc(db, "customer_equipment", "e1"), { tenantId: ALPHA, clientId: "c1", name: "Split" });
    await setDoc(doc(db, "customer_equipment", "e-beta"), { tenantId: BETA, clientId: "c9", name: "DVR" });
    await setDoc(doc(db, "customer_equipment", "e-demo"), { tenantId: "demo-seguranca", name: "Central" });
    await setDoc(doc(db, "stock_movements", "m1"), { tenantId: ALPHA, productId: "p1", quantity: -1 });
    await setDoc(doc(db, "service_order_counters", ALPHA), { tenantId: ALPHA, nextNumber: 3 });
    await setDoc(doc(db, "service_contracts", "ct1"), { tenantId: ALPHA, status: "active", monthlyAmount: 129 });
    await setDoc(doc(db, "service_contracts", "ct-beta"), { tenantId: BETA, status: "active", monthlyAmount: 90 });
    await setDoc(doc(db, "service_contracts", "ct-demo"), { tenantId: "demo-seguranca", status: "active" });
  });
});

function ctx(uid: string, role = "MEMBER", tenantId = ALPHA) {
  return testEnv
    .authenticatedContext(uid, { role, tenantId, masterId: "dono", subscriptionStatus: "active" })
    .firestore();
}

describe("service_orders", () => {
  it("o técnico lê a OS dele e não a dos outros", async () => {
    await assertSucceeds(getDoc(doc(ctx("diego"), "service_orders", "do-diego")));
    await assertFails(getDoc(doc(ctx("diego"), "service_orders", "da-lia")));
    await assertFails(getDoc(doc(ctx("diego"), "service_orders", "sem-tecnico")));
  });

  it("a lista do técnico passa filtrando por ele e traz só as dele", async () => {
    const snap = await assertSucceeds(
      getDocs(
        query(
          collection(ctx("diego"), "service_orders"),
          where("tenantId", "==", ALPHA),
          where("technicianUids", "array-contains", "diego"),
          limit(300),
        ),
      ),
    );
    expect(snap.docs.map((d) => d.id)).toEqual(["do-diego"]);
  });

  it("a lista da empresa inteira é recusada para o técnico", async () => {
    await assertFails(
      getDocs(query(collection(ctx("diego"), "service_orders"), where("tenantId", "==", ALPHA), limit(300))),
    );
  });

  it("o membro com o escopo service_orders_all lê todas, pela lista da empresa", async () => {
    const snap = await assertSucceeds(
      getDocs(query(collection(ctx("coordenadora"), "service_orders"), where("tenantId", "==", ALPHA), limit(300))),
    );
    expect(snap.size).toBe(3);
  });

  it("o escopo desligado não conta", async () => {
    await assertFails(getDoc(doc(ctx("sem-escopo"), "service_orders", "da-lia")));
  });

  it("o dono lê todas", async () => {
    await assertSucceeds(getDoc(doc(ctx("dono", "MASTER"), "service_orders", "sem-tecnico")));
  });

  it("ninguém lê OS de outra empresa, nem o técnico citado nela", async () => {
    await assertFails(getDoc(doc(ctx("diego"), "service_orders", "outra-empresa")));
    await assertFails(getDoc(doc(ctx("dono", "MASTER"), "service_orders", "outra-empresa")));
  });

  it("conta free lê a OS de demonstração", async () => {
    await assertSucceeds(getDoc(doc(ctx("free-1", "free", "tenant_free1"), "service_orders", "demo-1")));
  });

  it("ninguém grava pelo cliente, nem o dono", async () => {
    await assertFails(setDoc(doc(ctx("dono", "MASTER"), "service_orders", "nova"), { tenantId: ALPHA }));
    await assertFails(deleteDoc(doc(ctx("diego"), "service_orders", "do-diego")));
  });
});

describe("customer_equipment e stock_movements", () => {
  it("membro da empresa lê; outra empresa não", async () => {
    await assertSucceeds(getDoc(doc(ctx("diego"), "customer_equipment", "e1")));
    await assertSucceeds(getDoc(doc(ctx("diego"), "stock_movements", "m1")));
    await assertFails(getDoc(doc(ctx("diego"), "customer_equipment", "e-beta")));
  });

  it("conta free lê o equipamento de demonstração", async () => {
    await assertSucceeds(getDoc(doc(ctx("free-1", "free", "tenant_free1"), "customer_equipment", "e-demo")));
  });

  it("escrita só pelo backend", async () => {
    await assertFails(setDoc(doc(ctx("dono", "MASTER"), "customer_equipment", "novo"), { tenantId: ALPHA }));
    await assertFails(setDoc(doc(ctx("dono", "MASTER"), "stock_movements", "novo"), { tenantId: ALPHA }));
  });
});

describe("service_contracts", () => {
  it("membro da empresa lê; outra empresa não", async () => {
    await assertSucceeds(getDoc(doc(ctx("diego"), "service_contracts", "ct1")));
    await assertFails(getDoc(doc(ctx("diego"), "service_contracts", "ct-beta")));
    await assertSucceeds(
      getDocs(query(collection(ctx("diego"), "service_contracts"), where("tenantId", "==", ALPHA), limit(200))),
    );
  });

  it("conta free lê o contrato de demonstração e não o de uma empresa", async () => {
    await assertSucceeds(getDoc(doc(ctx("free-1", "free", "tenant_free1"), "service_contracts", "ct-demo")));
    await assertFails(getDoc(doc(ctx("free-1", "free", "tenant_free1"), "service_contracts", "ct1")));
  });

  it("escrita só pelo backend, nem o dono grava", async () => {
    await assertFails(setDoc(doc(ctx("dono", "MASTER"), "service_contracts", "novo"), { tenantId: ALPHA }));
    await assertFails(
      setDoc(doc(ctx("dono", "MASTER"), "service_contracts", "ct1"), { tenantId: ALPHA, status: "active", monthlyAmount: 1 }),
    );
    await assertFails(deleteDoc(doc(ctx("dono", "MASTER"), "service_contracts", "ct1")));
  });
});

describe("service_order_counters e shared_service_orders", () => {
  it("nem o dono lê o contador", async () => {
    await assertFails(getDoc(doc(ctx("dono", "MASTER"), "service_order_counters", ALPHA)));
  });

  it("o link público só é resolvido pelo backend", async () => {
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), "shared_service_orders", "tok"), { tenantId: ALPHA, serviceOrderId: "do-diego" });
    });
    await assertFails(getDoc(doc(ctx("dono", "MASTER"), "shared_service_orders", "tok")));
  });
});
