import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * The LOCAL DEV superadmin TOTP bypass mints a custom token carrying
 * `dev_mfa_bypass: true`. The Firestore rules' `hasMfa()` gate must accept that
 * claim in lieu of `firebase.sign_in_second_factor`, so the bypassed superadmin
 * keeps full client-SDK privileged access (e.g. the live observability
 * dashboard). A superadmin WITHOUT either signal stays denied.
 */

let testEnv: RulesTestEnvironment;

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

afterEach(async () => {
  await testEnv.clearFirestore();
});

// Superadmin signed in via the dev bypass custom token (no native second factor).
function superAdminDevBypassDb() {
  return testEnv
    .authenticatedContext("uid-super", {
      role: "superadmin",
      dev_mfa_bypass: true,
    })
    .firestore();
}
// Superadmin via real native MFA.
function superAdminMfaDb() {
  return testEnv
    .authenticatedContext("uid-super", {
      role: "superadmin",
      firebase: { sign_in_second_factor: "totp" },
    })
    .firestore();
}
// Superadmin with neither signal — must be denied.
function superAdminNoMfaDb() {
  return testEnv
    .authenticatedContext("uid-super", { role: "superadmin" })
    .firestore();
}
// A non-superadmin presenting a forged dev_mfa_bypass claim — must be denied
// (the claim only lifts the MFA gate; the superadmin role check still applies).
function tenantAdminForgedBypassDb() {
  return testEnv
    .authenticatedContext("uid-a", {
      tenantId: "t-a",
      role: "admin",
      masterId: "uid-a",
      dev_mfa_bypass: true,
    })
    .firestore();
}

async function seed(
  collectionPath: string,
  id: string,
  data: Record<string, unknown>,
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionPath, id), data);
  });
}

describe("dev_mfa_bypass claim — superadmin client access", () => {
  beforeEach(async () => {
    await seed("error_issues", "fp1", {
      fingerprint: "fp1",
      status: "unresolved",
      count: 3,
    });
  });

  test("dev-bypass superadmin can read (claim satisfies hasMfa)", async () => {
    await assertSucceeds(
      getDoc(doc(superAdminDevBypassDb(), "error_issues", "fp1")),
    );
  });

  test("native-MFA superadmin can still read", async () => {
    await assertSucceeds(getDoc(doc(superAdminMfaDb(), "error_issues", "fp1")));
  });

  test("superadmin without MFA and without the claim is denied", async () => {
    await assertFails(getDoc(doc(superAdminNoMfaDb(), "error_issues", "fp1")));
  });

  test("non-superadmin with a forged dev_mfa_bypass claim is still denied", async () => {
    await assertFails(
      getDoc(doc(tenantAdminForgedBypassDb(), "error_issues", "fp1")),
    );
  });

  test("client writes stay denied even for the dev-bypass superadmin", async () => {
    await assertFails(
      setDoc(doc(superAdminDevBypassDb(), "error_issues", "fp2"), {
        forged: true,
      }),
    );
  });
});
