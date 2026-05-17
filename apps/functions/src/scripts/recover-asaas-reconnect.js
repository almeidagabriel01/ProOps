/**
 * recover-asaas-reconnect.js
 *
 * Recupera credenciais Asaas de uma subconta stuck e grava _asaasReconnect no Firestore.
 * Usa o token OAuth do firebase-tools local — não precisa de service account.
 *
 * PRÉ-REQUISITO antes de rodar:
 *   Whitelist Asaas sandbox (Minha Conta → Segurança → Whitelist de IPs):
 *     - Remover: 0.0.0.0 (se existir)
 *     - Adicionar: 187.73.166.97
 *
 * Como rodar:
 *   node apps/functions/src/scripts/recover-asaas-reconnect.js
 *
 * PÓS-EXECUÇÃO:
 *   1. Remover 187.73.166.97 da whitelist Asaas (deixar vazia)
 *   2. ProOps → Settings → Asaas → Reconectar com mesmo email/CNPJ
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Config ────────────────────────────────────────────────────────────────

const TENANT_ID = "lyft-connect";
const SUBCONTA_ID = "6243385d-ad52-42c5-b2e9-b909997352ee";
const ASAAS_BASE = "https://api-sandbox.asaas.com";
const FIREBASE_PROJECT = "erp-softcode";

// Firebase-tools OAuth app credentials (public, embedded in firebase-tools source)
const FB_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FB_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

// ─── Helpers ────────────────────────────────────────────────────────────────

function readEnvFile(filePath) {
  const vars = {};
  try {
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[t.slice(0, eq).trim()] = val;
    }
  } catch {}
  return vars;
}

function request(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers,
          ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr).toString() } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data;
          try { data = JSON.parse(text); } catch { data = { _raw: text }; }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function formPost(url, params) {
  return new Promise((resolve, reject) => {
    const bodyStr = new URLSearchParams(params).toString();
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(bodyStr).toString(),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data;
          try { data = JSON.parse(text); } catch { data = { _raw: text }; }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// Convert plain JS object to Firestore REST API typed field map
function toFirestoreValue(val) {
  if (val === null) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== recover-asaas-reconnect ===");
  console.log(`Tenant:    ${TENANT_ID}`);
  console.log(`Subconta:  ${SUBCONTA_ID}`);

  // 1. Load Asaas master key from env file
  const envPath = path.join(__dirname, "..", "..", ".env.erp-softcode");
  const env = readEnvFile(envPath);
  const masterKey = env["ASAAS_MASTER_API_KEY"] || process.env.ASAAS_MASTER_API_KEY;
  if (!masterKey) throw new Error("ASAAS_MASTER_API_KEY não encontrada em .env.erp-softcode");
  console.log(`\nAsaas master key: ${masterKey.slice(0, 15)}...`);

  // 2. Load firebase-tools refresh token
  const fbConfigPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  let refreshToken;
  try {
    const fbConfig = JSON.parse(fs.readFileSync(fbConfigPath, "utf8"));
    refreshToken = fbConfig?.tokens?.refresh_token;
  } catch (e) {
    throw new Error(`Não foi possível ler firebase-tools config em ${fbConfigPath}: ${e.message}`);
  }
  if (!refreshToken) throw new Error("refresh_token não encontrado no firebase-tools config");
  console.log(`Firebase refresh token: ${refreshToken.slice(0, 10)}...`);

  // 3. Refresh OAuth access token
  console.log("\n[1/4] Atualizando access token do Firebase...");
  const tokenResp = await formPost("https://oauth2.googleapis.com/token", {
    client_id: FB_CLIENT_ID,
    client_secret: FB_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (tokenResp.status !== 200 || !tokenResp.data.access_token) {
    console.error("  Resposta:", JSON.stringify(tokenResp.data, null, 2));
    throw new Error(`Token refresh falhou: status ${tokenResp.status}`);
  }
  const accessToken = tokenResp.data.access_token;
  console.log(`  → access token obtido (${tokenResp.data.token_type})`);

  // 4. Call Asaas POST /v3/accounts/:id/accessTokens (requires local IP in whitelist)
  console.log("\n[2/4] Criando access token Asaas (precisa de IP na whitelist)...");
  const dateLabel = new Date().toISOString().slice(0, 10);
  const tokenName = `ProOps Reconnect ${dateLabel}`;

  const createResp = await request(
    `${ASAAS_BASE}/v3/accounts/${SUBCONTA_ID}/accessTokens`,
    "POST",
    { access_token: masterKey },
    { name: tokenName }
  );
  console.log(`  → status: ${createResp.status}`);
  if (createResp.status < 200 || createResp.status >= 300) {
    console.error("  body:", JSON.stringify(createResp.data, null, 2));
    throw new Error(`POST accessTokens falhou. Verifique se ${await getPublicIp()} está na whitelist Asaas.`);
  }
  const tokenId = createResp.data?.id;
  if (!tokenId) {
    console.error("  body:", JSON.stringify(createResp.data, null, 2));
    throw new Error("POST accessTokens: sem campo 'id' na resposta");
  }
  console.log(`  → tokenId: ${tokenId}`);

  // 5. Call Asaas PUT to enable token and get key
  console.log("\n[3/4] Habilitando token e obtendo chave...");
  const enableResp = await request(
    `${ASAAS_BASE}/v3/accounts/${SUBCONTA_ID}/accessTokens/${tokenId}`,
    "PUT",
    { access_token: masterKey },
    { name: tokenName, enabled: true }
  );
  console.log(`  → status: ${enableResp.status}`);
  if (enableResp.status < 200 || enableResp.status >= 300) {
    console.error("  body:", JSON.stringify(enableResp.data, null, 2));
    throw new Error("PUT accessTokens falhou");
  }
  const asaasApiKey = enableResp.data?.key;
  if (!asaasApiKey) {
    console.error("  body:", JSON.stringify(enableResp.data, null, 2));
    throw new Error("PUT accessTokens: sem campo 'key' na resposta");
  }
  console.log(`  → API key: ${asaasApiKey.slice(0, 15)}...`);

  // 6. Get walletId from listing
  let walletId = "";
  try {
    const listResp = await request(`${ASAAS_BASE}/v3/accounts?limit=50`, "GET", { access_token: masterKey });
    const accounts = listResp.data?.data ?? [];
    const found = accounts.find((a) => a.id === SUBCONTA_ID);
    walletId = found?.walletId ?? "";
    if (walletId) console.log(`  → walletId: ${walletId}`);
  } catch {}

  // 7. Write _asaasReconnect to Firestore via REST API
  console.log("\n[4/4] Gravando _asaasReconnect no Firestore...");
  const archive = {
    subAccountId: SUBCONTA_ID,
    apiKey: asaasApiKey,
    ...(walletId ? { walletId } : {}),
    savedAt: new Date().toISOString(),
  };

  const firestoreBody = {
    fields: {
      _asaasReconnect: toFirestoreValue(archive),
    },
  };

  const docPath = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${TENANT_ID}`;
  const firestoreUrl = `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=_asaasReconnect`;

  const fsResp = await request(firestoreUrl, "PATCH", {
    Authorization: `Bearer ${accessToken}`,
  }, firestoreBody);

  if (fsResp.status < 200 || fsResp.status >= 300) {
    console.error("  Firestore body:", JSON.stringify(fsResp.data, null, 2));
    throw new Error(`Firestore PATCH falhou: status ${fsResp.status}`);
  }
  console.log(`  → _asaasReconnect gravado com sucesso!`);

  console.log("\n✅ Recuperação concluída!");
  console.log("\nPRÓXIMOS PASSOS:");
  console.log("  1. Remova 187.73.166.97 da whitelist Asaas (deixe vazia)");
  console.log("  2. ProOps → Settings → Asaas → Reconectar");
  console.log("     (use o mesmo email e CNPJ — deve funcionar sem erro)");
  console.log("  3. Verifique no painel Asaas que o webhook foi registrado");
}

async function getPublicIp() {
  try {
    const r = await request("https://api.ipify.org?format=json", "GET", {});
    return r.data?.ip ?? "IP desconhecido";
  } catch { return "IP desconhecido"; }
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});
