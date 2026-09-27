import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { deleteField, doc, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * O cadastro grava o doc do tenant direto do navegador, entao as rules sao a
 * unica validacao do nicho nesse caminho. Antes aceitavam qualquer texto, e o
 * master podia trocar o nicho da propria empresa: um nicho desconhecido vira
 * automacao em silencio, e trocar deixa produto, proposta e obra no formato do
 * nicho antigo. O nicho nunca muda depois do cadastro, nem pelo superadmin.
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

afterEach(async () => {
  await testEnv.clearFirestore();
});

const signupDb = () => testEnv.authenticatedContext("uid-novo", {}).firestore();
const masterDb = () =>
  testEnv.authenticatedContext("uid-a", { tenantId: "t-a", role: "admin", masterId: "uid-a" }).firestore();
const superAdminDb = () =>
  testEnv
    .authenticatedContext("uid-super", { role: "superadmin", firebase: { sign_in_second_factor: "totp" } })
    .firestore();

const signupTenant = (niche?: unknown) => ({
  name: "Empresa",
  slug: "empresa",
  primaryColor: "#000000",
  logoUrl: "",
  ...(niche === undefined ? {} : { niche }),
  createdAt: "2026-09-27T10:00:00.000Z",
});

async function seedTenant() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "tenants", "t-a"), {
      tenantId: "t-a",
      name: "Empresa A",
      niche: "automacao_residencial",
    });
    await setDoc(doc(ctx.firestore(), "users", "uid-a"), { tenantId: "t-a", role: "admin" });
  });
}

describe("tenants: nicho no cadastro", () => {
  test.each(["automacao_residencial", "cortinas", "seguranca_eletronica"])("aceita o nicho %s", async (niche) => {
    await assertSucceeds(setDoc(doc(signupDb(), "tenants", "tenant_uid-novo"), signupTenant(niche)));
  });

  test.each(["", "decoracao", "Cortinas", 7])("recusa o nicho %p", async (niche) => {
    await assertFails(setDoc(doc(signupDb(), "tenants", "tenant_uid-novo"), signupTenant(niche)));
  });

  test("recusa cadastro sem nicho", async () => {
    await assertFails(setDoc(doc(signupDb(), "tenants", "tenant_uid-novo"), signupTenant()));
  });
});

describe("tenants: troca de nicho", () => {
  beforeEach(seedTenant);

  test("master nao troca o nicho", async () => {
    await assertFails(updateDoc(doc(masterDb(), "tenants", "t-a"), { niche: "cortinas" }));
  });

  test("master continua editando o nome", async () => {
    await assertSucceeds(updateDoc(doc(masterDb(), "tenants", "t-a"), { name: "Novo nome" }));
  });

  test("superadmin tambem nao troca o nicho", async () => {
    await assertFails(updateDoc(doc(superAdminDb(), "tenants", "t-a"), { niche: "cortinas" }));
  });

  test("superadmin nao apaga o nicho", async () => {
    await assertFails(updateDoc(doc(superAdminDb(), "tenants", "t-a"), { niche: deleteField() }));
  });

  test("superadmin nao grava o campo legado tenantNiche", async () => {
    await assertFails(updateDoc(doc(superAdminDb(), "tenants", "t-a"), { tenantNiche: "cortinas" }));
  });

  test("superadmin edita o resto mantendo o nicho", async () => {
    await assertSucceeds(updateDoc(doc(superAdminDb(), "tenants", "t-a"), { name: "Outro nome" }));
    await assertSucceeds(
      updateDoc(doc(superAdminDb(), "tenants", "t-a"), { niche: "automacao_residencial", name: "X" }),
    );
  });

  test("superadmin cria empresa so com nicho que existe", async () => {
    await assertSucceeds(
      setDoc(doc(superAdminDb(), "tenants", "t-novo"), { name: "Nova", niche: "seguranca_eletronica" }),
    );
    await assertFails(setDoc(doc(superAdminDb(), "tenants", "t-outro"), { name: "Nova", niche: "x" }));
    await assertFails(setDoc(doc(superAdminDb(), "tenants", "t-sem"), { name: "Nova" }));
  });
});
