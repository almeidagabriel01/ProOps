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
  updateDoc,
  where,
} from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Central de notificações: cada pessoa lê só o que foi endereçado a ela
 * (`recipientUids`). Antes, qualquer membro lia toda notificação da empresa,
 * inclusive as do financeiro sem ter acesso ao financeiro.
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
    for (const uid of ["dono", "vendedor", "financeiro"]) {
      await setDoc(doc(db, "users", uid), { tenantId: ALPHA, role: uid === "dono" ? "MASTER" : "MEMBER" });
    }
    await setDoc(doc(db, "notifications", "pago"), {
      tenantId: ALPHA,
      type: "transaction_paid_online",
      recipientUids: ["dono", "financeiro"],
      readBy: [],
      createdAt: "2026-09-26T10:00:00.000Z",
    });
    await setDoc(doc(db, "notifications", "aceite"), {
      tenantId: ALPHA,
      type: "proposal_accepted",
      recipientUids: ["dono", "vendedor"],
      readBy: [],
      createdAt: "2026-09-26T11:00:00.000Z",
    });
    // Anterior à central (sem destinatários): só o backfill a devolve.
    await setDoc(doc(db, "notifications", "antiga"), {
      tenantId: ALPHA,
      type: "proposal_viewed",
      createdAt: "2026-09-01T11:00:00.000Z",
    });
    await setDoc(doc(db, "notifications", "outra-empresa"), {
      tenantId: BETA,
      type: "proposal_viewed",
      recipientUids: ["vendedor"],
      createdAt: "2026-09-26T11:00:00.000Z",
    });
    await setDoc(doc(db, "notifications", "demo-1"), {
      tenantId: "demo",
      type: "proposal_accepted",
      recipientUids: [],
      createdAt: "2026-09-26T11:00:00.000Z",
    });
  });
});

function ctx(uid: string, role = "MEMBER", tenantId = ALPHA) {
  return testEnv
    .authenticatedContext(uid, { role, tenantId, masterId: "dono", subscriptionStatus: "active" })
    .firestore();
}

function inbox(db: ReturnType<typeof ctx>, uid: string, tenantId = ALPHA) {
  return query(
    collection(db, "notifications"),
    where("tenantId", "==", tenantId),
    where("recipientUids", "array-contains", uid),
    orderBy("createdAt", "desc"),
    limit(50),
  );
}

describe("leitura por destinatário", () => {
  it("o destinatário lê a notificação", async () => {
    await assertSucceeds(getDoc(doc(ctx("financeiro"), "notifications", "pago")));
  });

  it("membro da mesma empresa que não é destinatário não lê (o vendedor não vê o pagamento)", async () => {
    await assertFails(getDoc(doc(ctx("vendedor"), "notifications", "pago")));
  });

  it("nem o dono lê o que não foi endereçado a ele", async () => {
    await assertFails(getDoc(doc(ctx("dono", "MASTER"), "notifications", "antiga")));
  });

  it("a consulta do sino passa e devolve só o que é da pessoa", async () => {
    const snap = await assertSucceeds(getDocs(inbox(ctx("vendedor"), "vendedor")));
    expect(snap.docs.map((d) => d.id)).toEqual(["aceite"]);
  });

  it("a consulta antiga (empresa inteira) é recusada para quem não é superadmin", async () => {
    await assertFails(
      getDocs(
        query(
          collection(ctx("dono", "MASTER"), "notifications"),
          where("tenantId", "==", ALPHA),
          orderBy("createdAt", "desc"),
          limit(50),
        ),
      ),
    );
  });

  it("destinatário de outra empresa não lê cruzando o tenant", async () => {
    await assertFails(getDoc(doc(ctx("vendedor"), "notifications", "outra-empresa")));
  });

  it("conta free lê as notificações de demonstração", async () => {
    await assertSucceeds(getDoc(doc(ctx("free-1", "free", "tenant_free1"), "notifications", "demo-1")));
  });

  it("superadmin com MFA lê a visão da empresa", async () => {
    const superDb = testEnv
      .authenticatedContext("super", { role: "SUPERADMIN", firebase: { sign_in_second_factor: "totp" } })
      .firestore();
    await assertSucceeds(getDoc(doc(superDb, "notifications", "antiga")));
  });

  it("ninguém grava pelo cliente, nem para marcar como lida", async () => {
    await assertFails(updateDoc(doc(ctx("financeiro"), "notifications", "pago"), { readBy: ["financeiro"] }));
    await assertFails(deleteDoc(doc(ctx("dono", "MASTER"), "notifications", "pago")));
  });
});
