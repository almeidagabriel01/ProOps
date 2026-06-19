import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
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

afterEach(async () => {
  await testEnv.clearFirestore();
});

// Superadmin context WITH MFA (second factor) — matches isSuperAdmin() in rules.
function superAdminMfaDb() {
  return testEnv
    .authenticatedContext("uid-super", { role: "superadmin", firebase: { sign_in_second_factor: "totp" } })
    .firestore();
}
function superAdminNoMfaDb() {
  return testEnv.authenticatedContext("uid-super", { role: "superadmin" }).firestore();
}
function tenantAdminDb() {
  return testEnv
    .authenticatedContext("uid-a", { tenantId: "t-a", role: "admin", masterId: "uid-a" })
    .firestore();
}
function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seed(collectionPath: string, id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionPath, id), data);
  });
}

describe("error_issues client access", () => {
  beforeEach(async () => {
    await seed("error_issues", "fp1", { fingerprint: "fp1", status: "unresolved", count: 3 });
  });

  test("MFA superadmin can read", async () => {
    await assertSucceeds(getDoc(doc(superAdminMfaDb(), "error_issues", "fp1")));
  });
  test("superadmin without MFA is denied", async () => {
    await assertFails(getDoc(doc(superAdminNoMfaDb(), "error_issues", "fp1")));
  });
  test("tenant admin is denied", async () => {
    await assertFails(getDoc(doc(tenantAdminDb(), "error_issues", "fp1")));
  });
  test("unauthenticated is denied", async () => {
    await assertFails(getDoc(doc(unauthDb(), "error_issues", "fp1")));
  });
  test("any client write is denied (even MFA superadmin)", async () => {
    await assertFails(setDoc(doc(superAdminMfaDb(), "error_issues", "fp2"), { forged: true }));
  });
});

describe("error_metrics client access", () => {
  test("MFA superadmin can read, write denied", async () => {
    await seed("error_metrics", "2026061914", { counters: {} });
    await assertSucceeds(getDoc(doc(superAdminMfaDb(), "error_metrics", "2026061914")));
    await assertFails(setDoc(doc(superAdminMfaDb(), "error_metrics", "x"), { counters: {} }));
  });
});
