const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUBCONTA_ID = '6243385d-ad52-42c5-b2e9-b909997352ee';
const TENANT_ID = 'tenant_7WBPETke4LOAd1JF8TBB4DL6mC33';
const ASAAS_BASE = 'https://api-sandbox.asaas.com';
const FB_PROJECT = 'erp-softcode';
const FB_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FB_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function readEnv(filePath) {
  const vars = {};
  try {
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      vars[t.slice(0, eq).trim()] = val;
    }
  } catch {}
  return vars;
}

function formPost(url, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, res => { const c=[]; res.on('data',x=>c.push(x)); res.on('end',()=>resolve(JSON.parse(Buffer.concat(c).toString()))); });
    req.on('error', reject); req.write(body); req.end();
  });
}

function request(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bs = body ? JSON.stringify(body) : undefined;
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers: {
      'Content-Type': 'application/json', 'Accept': 'application/json', ...headers,
      ...(bs ? {'Content-Length': Buffer.byteLength(bs).toString()} : {})
    }}, res => { const c=[]; res.on('data',x=>c.push(x)); res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(c).toString())})); });
    req.on('error', reject); if (bs) req.write(bs); req.end();
  });
}

function toFSValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'object' && !Array.isArray(val)) {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFSValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function main() {
  console.log('=== Asaas Reconnect Recovery ===');

  const env = readEnv(path.join(__dirname, '../../.env.erp-softcode'));
  const MASTER_KEY = env['ASAAS_MASTER_API_KEY'] || process.env.ASAAS_MASTER_API_KEY;
  if (!MASTER_KEY) { console.error('ASAAS_MASTER_API_KEY not found'); process.exit(1); }
  console.log('Master key loaded:', MASTER_KEY.substring(0, 15) + '...');

  const fbConfigPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const fbConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
  const refreshToken = fbConfig?.tokens?.refresh_token;
  if (!refreshToken) { console.error('No refresh_token in firebase-tools config'); process.exit(1); }
  console.log('Firebase refresh token loaded');

  console.log('[1/5] Refreshing Firebase OAuth token...');
  const tok = await formPost('https://oauth2.googleapis.com/token', {
    client_id: FB_CLIENT_ID, client_secret: FB_CLIENT_SECRET,
    refresh_token: refreshToken, grant_type: 'refresh_token',
  });
  if (!tok.access_token) { console.error('Token refresh failed:', JSON.stringify(tok)); process.exit(1); }
  const fbToken = tok.access_token;
  console.log('  OK');

  const dateLabel = new Date().toISOString().slice(0, 10);
  const tokenName = 'ProOps Reconnect ' + dateLabel;

  const ASAAS_HEADERS = { 'access_token': MASTER_KEY, 'User-Agent': 'axios/1.7.0' };

  console.log('[2/5] POST accessTokens...');
  const createResp = await request(
    ASAAS_BASE + '/v3/accounts/' + SUBCONTA_ID + '/accessTokens',
    'POST', ASAAS_HEADERS, { name: tokenName }
  );
  console.log('  status:', createResp.status);
  console.log('  full response:', JSON.stringify(createResp.data, null, 2));
  if (createResp.status < 200 || createResp.status >= 300) {
    process.exit(1);
  }
  // POST already creates the token as enabled and returns apiKey directly — no PUT needed
  const asaasApiKey = createResp.data?.apiKey;
  if (!asaasApiKey) { console.error('  No apiKey in POST response:', JSON.stringify(createResp.data)); process.exit(1); }
  console.log('  API key obtained:', asaasApiKey.substring(0, 15) + '...');

  let walletId = '';
  console.log('[4/5] Getting walletId...');
  try {
    const listResp = await request(ASAAS_BASE + '/v3/accounts?limit=50', 'GET', ASAAS_HEADERS);
    const found = (listResp.data?.data || []).find(a => a.id === SUBCONTA_ID);
    walletId = found?.walletId || '';
    console.log('  walletId:', walletId || '(not in listing)');
  } catch (e) { console.log('  walletId lookup error:', e.message); }

  console.log('[5/5] Writing _asaasReconnect to Firestore...');
  const archive = { subAccountId: SUBCONTA_ID, apiKey: asaasApiKey, ...(walletId ? { walletId } : {}), savedAt: new Date().toISOString() };
  const fsUrl = 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT +
    '/databases/(default)/documents/tenants/' + TENANT_ID + '?updateMask.fieldPaths=_asaasReconnect';

  const fsResp = await request(fsUrl, 'PATCH', { Authorization: 'Bearer ' + fbToken }, {
    fields: { _asaasReconnect: toFSValue(archive) }
  });
  console.log('  Firestore status:', fsResp.status);
  if (fsResp.status < 200 || fsResp.status >= 300) {
    console.error('  ERROR:', JSON.stringify(fsResp.data, null, 2)); process.exit(1);
  }

  console.log('\nSUCCESS!');
  console.log('1. Remova 187.73.166.97 da whitelist Asaas (deixe vazia)');
  console.log('2. ProOps -> Settings -> Asaas -> Reconectar com mesmo email/CNPJ');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
