import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * O histórico de ações da equipe (`member_audit`) é lido só pela API, pelo
 * dono e pelos administradores, e gravado só pelo backend. Pelo SDK, ninguém
 * lê nem escreve, nem o dono: assim o membro não apaga o próprio rastro.
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
    await setDoc(doc(ctx.firestore(), `tenants/${ALPHA}`), { name: "Alpha", subscriptionStatus: "active" });
    await setDoc(doc(ctx.firestore(), "users/master-alpha"), { tenantId: ALPHA, role: "MASTER" });
    await setDoc(doc(ctx.firestore(), "users/vend"), { tenantId: ALPHA, role: "MEMBER", masterId: "master-alpha" });
    await setDoc(doc(ctx.firestore(), "member_audit/a1"), { tenantId: ALPHA, actorUid: "vend", action: "proposal_approved" });
  });
});

function dbOf(uid: string, role: string) {
  return testEnv
    .authenticatedContext(uid, { role, tenantId: ALPHA, masterId: "master-alpha", subscriptionStatus: "active" })
    .firestore();
}

it("ninguém lê o histórico pelo SDK, nem o dono", async () => {
  await assertFails(getDoc(doc(dbOf("master-alpha", "MASTER"), "member_audit", "a1")));
  await assertFails(getDoc(doc(dbOf("vend", "MEMBER"), "member_audit", "a1")));
});

it("ninguém grava nem apaga o próprio rastro pelo SDK", async () => {
  await assertFails(setDoc(doc(dbOf("vend", "MEMBER"), "member_audit", "a1"), { tenantId: ALPHA }));
  await assertFails(setDoc(doc(dbOf("master-alpha", "MASTER"), "member_audit", "novo"), { tenantId: ALPHA }));
});
