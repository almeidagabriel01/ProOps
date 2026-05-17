/**
 * One-time recovery: generates a new Asaas API key for a stuck tenant and writes
 * it as _asaasReconnect so the tenant can reconnect via the ProOps UI.
 *
 * Pre-requisites:
 *   1. Asaas whitelist: add this machine's public IP, remove any 0.0.0.0
 *   2. Firebase credentials via one of:
 *      a) Set GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account.json>
 *      b) Run: gcloud auth application-default login
 *
 * Usage:
 *   cd apps/functions
 *   TENANT_ID=lyft-connect SUBCONTA_ID=6243385d-ad52-42c5-b2e9-b909997352ee \
 *     npx ts-node --esm src/scripts/recover-asaas-reconnect.ts
 *
 * Or with dotenv-cli:
 *   cd apps/functions
 *   npx dotenv -e .env.erp-softcode -- \
 *     npx ts-node src/scripts/recover-asaas-reconnect.ts
 *
 * After the script succeeds:
 *   - Remove this machine's IP from Asaas whitelist (empty = all IPs allowed)
 *   - Go to ProOps → Settings → Asaas → Reconectar
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

// ---------------------------------------------------------------------------
// 1. Load env file manually (avoids needing dotenv package at runtime)
// ---------------------------------------------------------------------------
function loadEnvFile(envPath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  } catch {
    // ignore — fall back to process.env
  }
  return vars;
}

// ---------------------------------------------------------------------------
// 2. Simple HTTPS fetch helper (no axios needed for this script)
// ---------------------------------------------------------------------------
function httpsRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr).toString() } : {}),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const text = Buffer.concat(chunks).toString("utf8");
          const data = text ? JSON.parse(text) : {};
          resolve({ status: res.statusCode ?? 0, data });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: {} });
        }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 3. Main recovery logic
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // Load env
  const envFile = path.join(__dirname, "..", "..", ".env.erp-softcode");
  const env = loadEnvFile(envFile);
  const merged = { ...env, ...process.env };

  const masterKey = merged["ASAAS_MASTER_API_KEY"];
  if (!masterKey) {
    throw new Error("ASAAS_MASTER_API_KEY not found — make sure .env.erp-softcode is present");
  }

  const tenantId = merged["TENANT_ID"] || "lyft-connect";
  const subaccountId = merged["SUBCONTA_ID"] || "6243385d-ad52-42c5-b2e9-b909997352ee";
  const baseUrl = "https://api-sandbox.asaas.com";

  console.log(`\n=== Asaas Reconnect Recovery ===`);
  console.log(`Tenant:     ${tenantId}`);
  console.log(`Subconta:   ${subaccountId}`);
  console.log(`Environment: sandbox`);
  console.log(`\nStep 1/3 — Criando access token...`);

  const dateLabel = new Date().toISOString().slice(0, 10);
  const tokenName = `ProOps Reconnect ${dateLabel}`;

  // POST /v3/accounts/:id/accessTokens — creates disabled token, returns { id }
  const createResp = await httpsRequest(
    `${baseUrl}/v3/accounts/${subaccountId}/accessTokens`,
    "POST",
    { access_token: masterKey },
    { name: tokenName },
  );

  console.log(`  → status: ${createResp.status}, body:`, JSON.stringify(createResp.data, null, 2));

  if (createResp.status < 200 || createResp.status >= 300) {
    throw new Error(`POST accessTokens falhou com status ${createResp.status}. Ver body acima.`);
  }

  const tokenId = (createResp.data as Record<string, unknown>).id as string;
  if (!tokenId) {
    throw new Error(`POST accessTokens retornou status OK mas sem campo 'id'. Ver body acima.`);
  }

  console.log(`  → Token criado: id=${tokenId}`);
  console.log(`\nStep 2/3 — Habilitando token...`);

  // PUT /v3/accounts/:id/accessTokens/:tokenId — enables token, returns { key }
  const enableResp = await httpsRequest(
    `${baseUrl}/v3/accounts/${subaccountId}/accessTokens/${tokenId}`,
    "PUT",
    { access_token: masterKey },
    { name: tokenName, enabled: true },
  );

  console.log(`  → status: ${enableResp.status}, body:`, JSON.stringify(enableResp.data, null, 2));

  if (enableResp.status < 200 || enableResp.status >= 300) {
    throw new Error(`PUT accessTokens falhou com status ${enableResp.status}. Ver body acima.`);
  }

  const apiKey = (enableResp.data as Record<string, unknown>).key as string;
  if (!apiKey) {
    throw new Error(`PUT accessTokens retornou status OK mas sem campo 'key'. Ver body acima.`);
  }

  console.log(`  → API key gerada: ${apiKey.slice(0, 12)}...`);

  // Get walletId by listing the subconta
  console.log(`\nStep 2b/3 — Buscando walletId da subconta...`);
  let walletId = "";
  try {
    const listResp = await httpsRequest(
      `${baseUrl}/v3/accounts?limit=20`,
      "GET",
      { access_token: masterKey },
    );
    const accounts = ((listResp.data as Record<string, unknown>).data ?? []) as Array<{
      id: string;
      walletId?: string;
    }>;
    const found = accounts.find((a) => a.id === subaccountId);
    walletId = found?.walletId ?? "";
    if (walletId) console.log(`  → walletId: ${walletId}`);
    else console.log(`  → walletId não encontrado na listagem (ok, prosseguindo)`);
  } catch (err) {
    console.warn(`  ⚠ Não foi possível buscar walletId:`, (err as Error).message);
  }

  // Build the _asaasReconnect payload
  const reconnectArchive = {
    subAccountId: subaccountId,
    apiKey,
    ...(walletId ? { walletId } : {}),
    savedAt: new Date().toISOString(),
    recoveredBy: "recover-asaas-reconnect script",
  };

  console.log(`\nStep 3/3 — Gravando _asaasReconnect no Firestore (tenants/${tenantId})...`);

  // Try to use Firebase Admin SDK
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require("firebase-admin");
    const { applicationDefault } = require("firebase-admin/app");

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: applicationDefault(),
        projectId: merged["GCLOUD_PROJECT"] || "erp-softcode",
      });
    }

    const db = admin.firestore();
    await db.collection("tenants").doc(tenantId).update({
      _asaasReconnect: reconnectArchive,
    });

    console.log(`  → _asaasReconnect gravado com sucesso!`);
    console.log(`\n✅ Recuperação concluída!`);
    console.log(`\nPróximos passos:`);
    console.log(`  1. Remova ${await getPublicIp()} da whitelist Asaas (deixe vazia)`);
    console.log(`  2. No ProOps: Settings → Asaas → Reconectar com mesmo email e CNPJ`);
    console.log(`  3. Deve funcionar sem erro (usa credenciais arquivadas, sem accessTokens)`);
  } catch (fbError) {
    // Firebase Admin failed — print values for manual entry
    console.error(`\n⚠ Firebase Admin não inicializou:`, (fbError as Error).message);
    console.log(`\n--- RESULTADO PARA ENTRADA MANUAL NO FIREBASE CONSOLE ---`);
    console.log(`Documento: tenants/${tenantId}`);
    console.log(`Campo: _asaasReconnect`);
    console.log(`Valor:`);
    console.log(JSON.stringify(reconnectArchive, null, 2));
    console.log(`\nAcesse: https://console.firebase.google.com/project/erp-softcode/firestore`);
    console.log(`Navegue até: tenants → ${tenantId}`);
    console.log(`Adicione o campo _asaasReconnect com o valor acima (tipo: map)`);
  }
}

async function getPublicIp(): Promise<string> {
  try {
    const resp = await httpsRequest("https://api.ipify.org?format=json", "GET", {});
    return ((resp.data as Record<string, unknown>).ip as string) ?? "seu IP local";
  } catch {
    return "seu IP local";
  }
}

main().catch((err: Error) => {
  console.error(`\n❌ Erro fatal:`, err.message);
  process.exit(1);
});
