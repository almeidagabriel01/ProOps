import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

let testEnv: RulesTestEnvironment;

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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "tenant_purge_jobs", "t-a"), {
      tenantId: "t-a",
      status: "running",
      stageIndex: 3,
    });
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

const superAdminMfa = () =>
  testEnv
    .authenticatedContext("uid-super", { role: "superadmin", firebase: { sign_in_second_factor: "totp" } })
    .firestore();
const superAdminNoMfa = () =>
  testEnv.authenticatedContext("uid-super", { role: "superadmin" }).firestore();
const tenantAdmin = () =>
  testEnv.authenticatedContext("uid-a", { tenantId: "t-a", role: "admin", masterId: "uid-a" }).firestore();

describe("tenant_purge_jobs", () => {
  test("superadmin com MFA acompanha o progresso", async () => {
    await assertSucceeds(getDoc(doc(superAdminMfa(), "tenant_purge_jobs", "t-a")));
  });
  test("superadmin sem MFA nao le", async () => {
    await assertFails(getDoc(doc(superAdminNoMfa(), "tenant_purge_jobs", "t-a")));
  });
  test("admin da propria empresa nao le", async () => {
    await assertFails(getDoc(doc(tenantAdmin(), "tenant_purge_jobs", "t-a")));
  });
  test("ninguem cria nem apaga pelo client (nem o superadmin)", async () => {
    await assertFails(setDoc(doc(superAdminMfa(), "tenant_purge_jobs", "t-b"), { status: "pending" }));
    await assertFails(deleteDoc(doc(superAdminMfa(), "tenant_purge_jobs", "t-a")));
  });
});
