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
 * "Só os meus": o alcance (`scope`) do doc de permissão da página. Sem o doc,
 * ou sem o campo, vale "all", o de sempre: nenhum membro muda no dia do
 * deploy. Com "own", o membro lê só o registro em que é o dono, e a lista dele
 * precisa trazer o filtro do dono (regra não é filtro). Lançamentos têm três
 * valores: tudo, só receitas e só os das vendas dele.
 */

let testEnv: RulesTestEnvironment;
const ALPHA = "tenant-alpha";

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

const VIEW = { canView: true, canCreate: true, canEdit: true, canDelete: false };

async function seedMember(uid: string, pages: Record<string, Record<string, unknown>>) {
  await seed(`users/${uid}`, { tenantId: ALPHA, role: "MEMBER", masterId: "master-alpha" });
  for (const [pageId, flags] of Object.entries(pages)) {
    await seed(`users/${uid}/permissions/${pageId}`, flags);
  }
}

function dbOf(uid: string, role = "MEMBER") {
  return testEnv
    .authenticatedContext(uid, { role, tenantId: ALPHA, masterId: "master-alpha", subscriptionStatus: "active" })
    .firestore();
}

/** As coleções com "só os meus": página do catálogo e o campo do dono. */
const SCOPED = [
  { collection: "proposals", pageId: "proposals", owner: "sellerId" },
  { collection: "clients", pageId: "clients", owner: "responsibleMemberId" },
  { collection: "leads", pageId: "kanban", owner: "ownerId" },
  { collection: "projects", pageId: "projects", owner: "assigneeId" },
  { collection: "spreadsheets", pageId: "spreadsheets", owner: "createdById" },
];

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(`tenants/${ALPHA}`, { name: "Alpha", subscriptionStatus: "active" });
  await seed("users/master-alpha", { tenantId: ALPHA, role: "MASTER" });
  for (const { collection: name, owner } of SCOPED) {
    await seed(`${name}/minha`, { tenantId: ALPHA, title: "Minha", [owner]: "vend" });
    await seed(`${name}/outra`, { tenantId: ALPHA, title: "De outra pessoa", [owner]: "outra" });
    await seed(`${name}/sem-dono`, { tenantId: ALPHA, title: "Sem dono" });
  }
  await seed("transactions/receita-minha", { tenantId: ALPHA, type: "income", amount: 100, sellerId: "vend" });
  await seed("transactions/receita-outra", { tenantId: ALPHA, type: "income", amount: 200, sellerId: "outra" });
  await seed("transactions/despesa", { tenantId: ALPHA, type: "expense", amount: 50 });
  await seed("transactions/comissao-minha", { tenantId: ALPHA, type: "expense", amount: 10, sellerId: "vend", isCommission: true });
  await seed("transaction_groups/proposal_p1", { tenantId: ALPHA, total: 300 });
});

describe.each(SCOPED)("$collection: alcance por $owner", ({ collection: name, pageId, owner }) => {
  it("sem o campo scope, o membro lê tudo como antes", async () => {
    await seedMember("vend", { [pageId]: VIEW, kanban: VIEW });
    const db = dbOf("vend");
    await assertSucceeds(getDoc(doc(db, name, "outra")));
    await assertSucceeds(getDocs(query(collection(db, name), where("tenantId", "==", ALPHA), limit(10))));
  });

  it("com 'own', lê o seu e não o de outra pessoa nem o sem dono", async () => {
    await seedMember("vend", { [pageId]: { ...VIEW, scope: "own" }, kanban: { ...VIEW, ...(pageId === "kanban" ? { scope: "own" } : {}) } });
    const db = dbOf("vend");
    await assertSucceeds(getDoc(doc(db, name, "minha")));
    await assertFails(getDoc(doc(db, name, "outra")));
    await assertFails(getDoc(doc(db, name, "sem-dono")));
  });

  it("com 'own', a lista precisa do filtro do dono", async () => {
    await seedMember("vend", { [pageId]: { ...VIEW, scope: "own" }, kanban: { ...VIEW, ...(pageId === "kanban" ? { scope: "own" } : {}) } });
    const db = dbOf("vend");
    await assertFails(getDocs(query(collection(db, name), where("tenantId", "==", ALPHA), limit(10))));
    const mine = await assertSucceeds(
      getDocs(query(collection(db, name), where("tenantId", "==", ALPHA), where(owner, "==", "vend"), limit(10))),
    );
    expect(mine.docs.map((d) => d.id)).toEqual(["minha"]);
  });

  it("dono e administradores leem tudo, mesmo com scope gravado", async () => {
    await seed("users/adm", { tenantId: ALPHA, role: "ADMIN", masterId: "master-alpha" });
    await seed(`users/adm/permissions/${pageId}`, { ...VIEW, scope: "own" });
    await assertSucceeds(getDoc(doc(dbOf("adm", "ADMIN"), name, "outra")));
    await assertSucceeds(getDoc(doc(dbOf("master-alpha", "MASTER"), name, "outra")));
  });
});

describe("transactions: tudo, só receitas e só as minhas", () => {
  const FIN = { canView: true, canCreate: false, canEdit: false, canDelete: false };

  it("'income' lê as receitas e nenhuma despesa (nem a comissão)", async () => {
    await seedMember("vend", { transactions: { ...FIN, scope: "income" } });
    const db = dbOf("vend");
    await assertSucceeds(getDoc(doc(db, "transactions", "receita-outra")));
    await assertFails(getDoc(doc(db, "transactions", "despesa")));
    await assertFails(getDoc(doc(db, "transactions", "comissao-minha")));
    const list = await assertSucceeds(
      getDocs(query(collection(db, "transactions"), where("tenantId", "==", ALPHA), where("type", "==", "income"), limit(10))),
    );
    expect(list.docs.map((d) => d.id).sort()).toEqual(["receita-minha", "receita-outra"]);
    await assertFails(getDocs(query(collection(db, "transactions"), where("tenantId", "==", ALPHA), limit(10))));
  });

  it("'mine' lê só os lançamentos das vendas dele", async () => {
    await seedMember("vend", { transactions: { ...FIN, scope: "mine" } });
    const db = dbOf("vend");
    await assertSucceeds(getDoc(doc(db, "transactions", "receita-minha")));
    await assertFails(getDoc(doc(db, "transactions", "receita-outra")));
    await assertFails(getDoc(doc(db, "transactions", "despesa")));
    await assertSucceeds(
      getDocs(query(collection(db, "transactions"), where("tenantId", "==", ALPHA), where("sellerId", "==", "vend"), limit(10))),
    );
  });

  it("Agrupados é só de quem vê tudo", async () => {
    await seedMember("vend", { transactions: { ...FIN, scope: "income" } });
    await assertFails(getDoc(doc(dbOf("vend"), "transaction_groups", "proposal_p1")));
    await seedMember("todos", { transactions: FIN });
    await assertSucceeds(getDoc(doc(dbOf("todos"), "transaction_groups", "proposal_p1")));
  });
});
