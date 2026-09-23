import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * tenant_presence guarda o ultimo acesso da empresa. So o backend le e grava:
 * o navegador nao deve conseguir forjar o proprio "ultimo acesso", nem ler o
 * de outra empresa.
 */

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
    await setDoc(doc(ctx.firestore(), "tenant_presence", "t-a"), {
      tenantId: "t-a",
      lastSeenAt: "2026-09-23T10:00:00.000Z",
    });
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

const tenantAdmin = () =>
  testEnv.authenticatedContext("uid-a", { tenantId: "t-a", role: "admin", masterId: "uid-a" }).firestore();
const superAdminMfa = () =>
  testEnv
    .authenticatedContext("uid-super", { role: "superadmin", firebase: { sign_in_second_factor: "totp" } })
    .firestore();

describe("tenant_presence", () => {
  test("a propria empresa nao le nem grava pelo navegador", async () => {
    await assertFails(getDoc(doc(tenantAdmin(), "tenant_presence", "t-a")));
    await assertFails(
      setDoc(doc(tenantAdmin(), "tenant_presence", "t-a"), { lastSeenAt: "2099-01-01T00:00:00.000Z" }),
    );
  });

  test("nem o super admin acessa pelo navegador: o painel le pelo backend", async () => {
    await assertFails(getDoc(doc(superAdminMfa(), "tenant_presence", "t-a")));
  });

  test("anonimo nao le", async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "tenant_presence", "t-a")));
  });
});
