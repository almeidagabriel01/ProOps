/**
 * Os workflows de deploy conferem que o secret FUNCTIONS_ENV_* traz cada chave
 * de integracao antes de publicar. A checagem e `grep -qE "^${key}=."`, que
 * reprova tanto a chave ausente quanto a de valor VAZIO.
 *
 * Este guard existe porque a ausencia da chave do Asaas nessa lista deixou o
 * modulo de pagamento online publicado e inutilizavel em producao: o
 * .env.erp-softcode-prod tinha ASAAS_MASTER_API_KEY com valor vazio, o deploy
 * passou sem alarme, e o sintoma so apareceu quando um cliente tentou habilitar
 * pagamentos e recebeu "Integracao Asaas nao configurada no servidor".
 *
 * As chaves do Asaas sao DIFERENTES nos dois workflows de proposito: dev roda
 * contra o sandbox (ASAAS_MASTER_API_KEY) e producao exige a chave real
 * (ASAAS_MASTER_API_KEY_PROD), que e justamente o que faz o backend falar com
 * api.asaas.com em vez de api-sandbox.asaas.com.
 */
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const SHARED_KEYS = [
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "FOCUS_NFE_MASTER_TOKEN",
  "FISCAL_SECRET_KMS_KEY",
  "CALENDAR_TOKEN_KMS_KEY",
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
];

const WORKFLOWS: Array<{ file: string; keys: string[] }> = [
  {
    file: "deploy-functions.yml",
    keys: [...SHARED_KEYS, "ASAAS_MASTER_API_KEY"],
  },
  {
    file: "deploy-production.yml",
    keys: [...SHARED_KEYS, "ASAAS_MASTER_API_KEY_PROD"],
  },
];

function readRequiredKeyList(file: string): string[] {
  const contents = fs.readFileSync(
    path.join(REPO_ROOT, ".github", "workflows", file),
    "utf8",
  );
  const line = contents.split(/\r?\n/).find((l) => l.includes("for key in"));
  if (!line) throw new Error(`${file}: loop "for key in" nao encontrado`);
  return line.replace(/^.*for key in/, "").trim().split(/\s+/).filter(Boolean);
}

describe("deploy workflows: lista de env vars obrigatorias", () => {
  it.each(WORKFLOWS)("$file cobra todas as chaves esperadas", ({ file, keys }) => {
    const declared = readRequiredKeyList(file);
    for (const key of keys) {
      expect(declared).toContain(key);
    }
  });

  it("nao cobra a chave de sandbox no deploy de producao", () => {
    // Exigir ASAAS_MASTER_API_KEY em producao faria o deploy falhar por uma
    // variavel que produção nao deve usar, e preenche-la abriria a porta para
    // onboardar cliente real contra o Asaas de teste.
    expect(readRequiredKeyList("deploy-production.yml")).not.toContain(
      "ASAAS_MASTER_API_KEY",
    );
  });

  it("a checagem reprova valor vazio, nao so chave ausente", () => {
    for (const { file } of WORKFLOWS) {
      const contents = fs.readFileSync(
        path.join(REPO_ROOT, ".github", "workflows", file),
        "utf8",
      );
      expect(contents).toContain('grep -qE "^${key}=."');
    }
  });
});
