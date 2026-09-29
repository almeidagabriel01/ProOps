/**
 * Sobe os emuladores das capturas e monta as empresas de exemplo.
 *
 *   npx tsx tests/capturas-do-erp/preparar.ts
 *
 * Deixa os emuladores no ar (o PID fica em `.capturas-pid`) para o spec de
 * captura rodar quantas vezes precisar; `encerrar.ts` os derruba. Idempotente:
 * rodar de novo com os emuladores no ar só refaz o seed.
 */
import { spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as admin from "firebase-admin";

import { EMPRESAS, MEMBROS, PROJETO, SENHA, URL_FUNCTIONS } from "./ambiente";

const RAIZ = path.resolve(__dirname, "../..");
const ARQUIVO_PID = path.join(RAIZ, ".capturas-pid");
const JAVA = "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.10.7-hotspot\\bin";

const ambienteDosEmuladores: NodeJS.ProcessEnv = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  GCLOUD_PROJECT: PROJETO,
  AI_PROVIDER: "mock",
  CRON_SECRET: process.env.CRON_SECRET ?? "capturas-cron-secret",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_test_fake_for_capturas",
  TENANT_PLAN_CAPABILITY_MODE: "enforce",
  CONFIRMATION_SECRET: process.env.CONFIRMATION_SECRET ?? "capturas-secret",
  // A descoberta das funções tem 10s por padrão, e com o `dev` e o `dev:backend`
  // rodando na mesma máquina ela estoura ("User code failed to load").
  FUNCTIONS_DISCOVERY_TIMEOUT: "120",
  PATH: process.platform === "win32" && fs.existsSync(JAVA) ? `${JAVA};${process.env.PATH}` : process.env.PATH,
};

async function esperar(url: string, rotulo: string, pronto: (r: Response) => Promise<boolean> = async () => true) {
  const inicio = Date.now();
  while (Date.now() - inicio < 180_000) {
    try {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (await pronto(resposta)) {
        console.log(`[capturas] ${rotulo} no ar.`);
        return;
      }
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`[capturas] ${rotulo} não subiu em 3 min.`);
}

async function emuladoresNoAr(): Promise<boolean> {
  try {
    await fetch("http://127.0.0.1:8080", { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

function subirEmuladores() {
  console.log("[capturas] Compilando o backend...");
  const build = spawnSync("npm", ["run", "build"], {
    cwd: path.join(RAIZ, "apps/functions"),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) throw new Error("[capturas] O build do backend falhou.");

  const args = [
    "firebase",
    "emulators:start",
    "--config",
    "firebase.capturas.json",
    "--project",
    PROJETO,
    "--only",
    "auth,firestore,storage,functions",
  ];
  const processo = spawn(process.platform === "win32" ? "cmd" : "npx", process.platform === "win32" ? ["/c", "npx", ...args] : args, {
    cwd: RAIZ,
    env: ambienteDosEmuladores,
    detached: true,
    stdio: "ignore",
  });
  if (processo.pid) fs.writeFileSync(ARQUIVO_PID, String(processo.pid), "utf8");
  processo.unref();
}

function semearDemonstracoes() {
  console.log("[capturas] Semeando as demonstrações dos nichos...");
  const r = spawnSync("npx", ["tsx", "src/scripts/seed-demo-tenant.ts"], {
    cwd: path.join(RAIZ, "apps/functions"),
    env: ambienteDosEmuladores,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) throw new Error("[capturas] O seed das demonstrações falhou.");
}

async function criarUsuario(
  app: admin.app.App,
  u: { uid: string; email: string; nome: string },
  tenantId: string,
  papel: "MASTER" | "MEMBER",
  masterId: string,
) {
  const auth = app.auth();
  try {
    await auth.createUser({ uid: u.uid, email: u.email, password: SENHA, displayName: u.nome, emailVerified: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/uid-already-exists" && code !== "auth/email-already-exists") throw err;
  }
  await auth.setCustomUserClaims(u.uid, { tenantId, role: papel, masterId, subscriptionStatus: "active" });
  const agora = new Date().toISOString();
  await app.firestore().collection("users").doc(u.uid).set({
    id: u.uid,
    tenantId,
    companyId: tenantId,
    name: u.nome,
    email: u.email,
    role: papel,
    masterId,
    status: "active",
    planId: "enterprise",
    subscriptionStatus: "active",
    createdAt: "2026-01-05T12:00:00.000Z",
    // Sem tutorial e sem o card de primeiros passos cobrindo a tela.
    onboarding: {
      version: "capturas",
      status: "skipped",
      completedStepIds: [],
      skippedAt: agora,
      welcomeSeenAt: agora,
      firstStepsDismissedAt: agora,
      updatedAt: agora,
    },
  });
}

/**
 * A demonstração de cada nicho vira uma empresa Enterprise ativa, com um dono.
 * É o que tira a tela do modo demonstração (somente leitura, com aviso) e
 * libera todos os módulos para a captura.
 */
async function montarEmpresas() {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  const app = admin.apps[0] ?? admin.initializeApp({ projectId: PROJETO });
  const db = app.firestore();

  for (const empresa of Object.values(EMPRESAS)) {
    await db.collection("tenants").doc(empresa.tenantId).set(
      {
        name: empresa.nome,
        plan: "enterprise",
        planId: "enterprise",
        subscriptionStatus: "active",
        isDemo: false,
      },
      { merge: true },
    );
    await criarUsuario(app, empresa.dono, empresa.tenantId, "MASTER", empresa.dono.uid);
  }

  const automacao = EMPRESAS.automacao_residencial;
  // As demonstrações não têm notas fiscais: a lista sairia vazia. Quatro notas
  // dos clientes da demonstração, só no emulador.
  const notas = [
    { id: "capturas_nfe_1", type: "nfe", status: "authorized", numero: "1284", clientId: "demo_client_ana", clientName: "Ana Ribeiro", valorTotal: 18450, dias: 2 },
    { id: "capturas_nfse_1", type: "nfse", status: "authorized", numero: "312", clientId: "demo_client_ana", clientName: "Ana Ribeiro", valorTotal: 4200, dias: 2 },
    { id: "capturas_nfe_2", type: "nfe", status: "authorized", numero: "1283", clientId: "demo_client_condo", clientName: "Condomínio Jardins", valorTotal: 9870, dias: 9 },
    { id: "capturas_nfse_2", type: "nfse", status: "processing", numero: undefined, clientId: "demo_client_bruno", clientName: "Bruno Carvalho", valorTotal: 1500, dias: 0 },
  ];
  for (const nota of notas) {
    const quando = new Date(Date.now() - nota.dias * 86_400_000).toISOString();
    await db.collection("invoices").doc(nota.id).set({
      id: nota.id,
      tenantId: automacao.tenantId,
      ref: nota.id,
      type: nota.type,
      status: nota.status,
      ...(nota.numero ? { numero: nota.numero, serie: "1", authorizedAt: quando } : {}),
      valorTotal: nota.valorTotal,
      clientId: nota.clientId,
      clientName: nota.clientName,
      createdAt: quando,
      updatedAt: quando,
    });
  }
  for (const membro of MEMBROS) {
    await criarUsuario(app, membro, automacao.tenantId, "MEMBER", automacao.dono.uid);
  }
  console.log(`[capturas] Empresas prontas: ${Object.values(EMPRESAS).map((e) => e.nome).join(", ")}.`);
}

async function principal() {
  if (await emuladoresNoAr()) {
    console.log("[capturas] Emuladores já no ar; só refazendo o seed.");
  } else {
    subirEmuladores();
  }
  await Promise.all([
    esperar("http://127.0.0.1:8080", "Firestore (8080)"),
    esperar("http://127.0.0.1:9099", "Auth (9099)"),
    esperar(`${URL_FUNCTIONS}/v1/proposals`, `Functions (${URL_FUNCTIONS})`, async (r) => {
      if (r.status !== 404) return true;
      return !(await r.text()).includes("does not exist");
    }),
  ]);
  semearDemonstracoes();
  await montarEmpresas();
  console.log("[capturas] Pronto. Rode o spec de capturas; `encerrar.ts` derruba os emuladores.");
  process.exit(0);
}

principal().catch((err) => {
  console.error(err);
  process.exit(1);
});
