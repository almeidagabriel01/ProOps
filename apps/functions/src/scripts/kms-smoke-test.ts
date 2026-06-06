/**
 * Smoke test do Cloud KMS — valida chave + IAM + env fazendo um round-trip
 * encrypt -> decrypt num valor descartavel. Rode ANTES da migracao real para
 * falhar rapido em caso de configuracao incorreta (chave errada, IAM faltando,
 * env ausente, ou credenciais ADC sem permissao de cryptoKeyEncrypterDecrypter).
 *
 * Credenciais: o cliente KMS usa ADC (Application Default Credentials), NAO o
 * cert do firebase-admin. Localmente, rode antes:
 *   gcloud auth application-default login
 * (ou aponte GOOGLE_APPLICATION_CREDENTIALS para um SA com permissao na chave).
 *
 * Usage:
 *   npx ts-node src/scripts/kms-smoke-test.ts
 */

import { initScriptAdmin } from "./_script-init";
import { encryptToken, decryptToken, isEncryptedToken } from "../lib/token-encryption";

async function main(): Promise<void> {
  const projectId = initScriptAdmin();
  const keyDesc =
    process.env.CALENDAR_TOKEN_KMS_KEY ||
    `${process.env.CALENDAR_TOKEN_KMS_KEYRING || "(keyring?)"}/${
      process.env.CALENDAR_TOKEN_KMS_KEY_ID || "(key?)"
    } @ ${process.env.CALENDAR_TOKEN_KMS_LOCATION || "southamerica-east1"}`;

  console.log(`[kms-smoke] project=${projectId}`);
  console.log(`[kms-smoke] key=${keyDesc}`);

  const sample = `kms-smoke-${projectId}-${"x".repeat(16)}`;

  const encrypted = await encryptToken(sample);
  console.log(
    `[kms-smoke] encrypt OK (prefixed=${isEncryptedToken(encrypted)}, len=${encrypted.length})`,
  );

  const decrypted = await decryptToken(encrypted);
  if (decrypted !== sample) {
    throw new Error("round-trip MISMATCH — decrypt nao bate com o original");
  }

  console.log("[kms-smoke] round-trip OK ✔");
}

main().catch((err: Error) => {
  console.error("\n[kms-smoke] FAIL:", err.message);
  process.exit(1);
});
