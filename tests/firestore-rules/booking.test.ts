import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Link de agendamento: expediente, pedidos e trava por dia vivem só no
 * backend. O token do link e os dados do cliente (telefone, endereço) não
 * podem ser lidos pelo SDK, nem pela própria empresa.
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

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants", ALPHA), { name: "Alpha", subscriptionStatus: "active" });
    await setDoc(doc(db, "users", "dono"), { tenantId: ALPHA, role: "MASTER" });
    await setDoc(doc(db, "booking_settings", ALPHA), { tenantId: ALPHA, publicToken: "segredo" });
    await setDoc(doc(db, "booking_requests", "r1"), { tenantId: ALPHA, phone: "11999990000" });
    await setDoc(doc(db, "booking_locks", `${ALPHA}_2026-09-28`), { tenantId: ALPHA });
  });
});

function master() {
  return testEnv
    .authenticatedContext("dono", { role: "MASTER", tenantId: ALPHA, subscriptionStatus: "active" })
    .firestore();
}

describe("booking", () => {
  it.each([
    ["booking_settings", ALPHA],
    ["booking_requests", "r1"],
    ["booking_locks", `${ALPHA}_2026-09-28`],
  ])("%s: nem o dono lê pelo SDK", async (coll, id) => {
    await assertFails(getDoc(doc(master(), coll, id)));
  });

  it("anônimo não lê o token do link", async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "booking_settings", ALPHA)));
  });

  it.each(["booking_settings", "booking_requests", "booking_locks"])("%s: ninguém grava pelo SDK", async (coll) => {
    await assertFails(setDoc(doc(master(), coll, "novo"), { tenantId: ALPHA }));
  });
});
