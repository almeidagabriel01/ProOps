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
 * O financeiro (lançamentos, resumos de grupo, carteiras e o histórico delas)
 * era legível por qualquer membro da empresa pelo SDK. Uma vendedora que o
 * dono só liberou no CRM lia o aluguel na aba Lançamentos do quadro, e o
 * técnico de campo lia o saldo das carteiras.
 *
 * Agora o membro precisa de "Ver" em Lançamentos (`transactions`) ou em
 * Carteiras (`wallet`). Dono e administradores leem tudo; o superadmin com
 * MFA e a conta free lendo o tenant de demonstração seguem como antes.
 */

let testEnv: RulesTestEnvironment;
const ALPHA = "tenant-alpha";
const BETA = "tenant-beta";
const FINANCE_COLLECTIONS = ["transactions", "transaction_groups", "wallets", "wallet_transactions"];

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

async function seed(docPath: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), docPath), data);
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

function listQuery(db: ReturnType<typeof memberDb>, name: string, tenantId = ALPHA) {
  return query(collection(db, name), where("tenantId", "==", tenantId), limit(10));
}

const SELLER = {
  kanban: { canView: true, canCreate: true, canEdit: true, canDelete: false },
  proposals: { canView: true, canCreate: true, canEdit: true, canDelete: false },
  clients: { canView: true, canCreate: true, canEdit: true, canDelete: false },
  products: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  transactions: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  wallet: { canView: false, canCreate: false, canEdit: false, canDelete: false },
};

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(`tenants/${ALPHA}`, { name: "Alpha", subscriptionStatus: "active" });
  await seed(`tenants/${BETA}`, { name: "Beta", subscriptionStatus: "active" });
  await seed("users/master-alpha", { tenantId: ALPHA, role: "MASTER" });
  for (const name of FINANCE_COLLECTIONS) {
    await seed(`${name}/alpha-1`, { tenantId: ALPHA, description: "Aluguel", amount: 9447, balance: 1000 });
    await seed(`${name}/beta-1`, { tenantId: BETA, description: "Outra", amount: 1 });
    await seed(`${name}/demo-1`, { tenantId: "demo", description: "Exemplo", amount: 10 });
  }
});

describe.each(FINANCE_COLLECTIONS)("%s: membro precisa de permissão do financeiro", (name) => {
  it("vendedora com CRM e Propostas, sem Lançamentos nem Carteiras, não lê nem lista", async () => {
    await seedMember("vend", SELLER);
    await assertFails(getDoc(doc(memberDb("vend"), name, "alpha-1")));
    await assertFails(getDocs(listQuery(memberDb("vend"), name)));
  });

  it("membro sem doc de permissão nenhum não lê", async () => {
    await seedMember("vazio", {});
    await assertFails(getDoc(doc(memberDb("vazio"), name, "alpha-1")));
  });

  it("membro com Lançamentos só editando, sem 'Ver', não lê", async () => {
    await seedMember("sem-ver", { transactions: { canView: false, canEdit: true } });
    await assertFails(getDoc(doc(memberDb("sem-ver"), name, "alpha-1")));
  });

  it("membro com 'Ver' em Lançamentos lê e lista", async () => {
    await seedMember("fin", { transactions: { canView: true } });
    await assertSucceeds(getDoc(doc(memberDb("fin"), name, "alpha-1")));
    await assertSucceeds(getDocs(listQuery(memberDb("fin"), name)));
  });

  it("membro com 'Ver' em Carteiras lê e lista", async () => {
    await seedMember("cart", { wallet: { canView: true } });
    await assertSucceeds(getDoc(doc(memberDb("cart"), name, "alpha-1")));
    await assertSucceeds(getDocs(listQuery(memberDb("cart"), name)));
  });

  it("com permissão, não lê de outra empresa", async () => {
    await seedMember("fin", { transactions: { canView: true } });
    await assertFails(getDoc(doc(memberDb("fin"), name, "beta-1")));
    await assertFails(getDocs(listQuery(memberDb("fin"), name, BETA)));
  });

  it.each(["MASTER", "ADMIN", "WK"])("%s lê sem doc de permissão", async (role) => {
    await seed("users/chefe", { tenantId: ALPHA, role });
    const db = testEnv
      .authenticatedContext("chefe", { role, tenantId: ALPHA, subscriptionStatus: "active" })
      .firestore();
    await assertSucceeds(getDoc(doc(db, name, "alpha-1")));
    await assertSucceeds(getDocs(listQuery(db, name)));
  });

  it("superadmin com MFA lê de qualquer empresa", async () => {
    await seed("users/sa", { role: "SUPERADMIN", tenantId: "" });
    const db = testEnv
      .authenticatedContext("sa", {
        role: "SUPERADMIN",
        firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" },
      })
      .firestore();
    await assertSucceeds(getDoc(doc(db, name, "beta-1")));
  });

  it("conta free lê a demonstração e não a empresa real", async () => {
    await seed("users/free1", { tenantId: "tenant_free1", role: "free" });
    const db = testEnv
      .authenticatedContext("free1", { role: "free", tenantId: "tenant_free1", subscriptionStatus: "free" })
      .firestore();
    await assertSucceeds(getDoc(doc(db, name, "demo-1")));
    await assertFails(getDoc(doc(db, name, "alpha-1")));
  });

  it("ninguém grava pelo cliente", async () => {
    await seedMember("fin", { transactions: { canView: true, canCreate: true, canEdit: true } });
    await assertFails(setDoc(doc(memberDb("fin"), name, "nova"), { tenantId: ALPHA }));
  });
});
