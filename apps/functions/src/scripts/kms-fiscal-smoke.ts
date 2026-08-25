/**
 * Smoke test da chave KMS fiscal.
 *
 * Prova que `FISCAL_SECRET_KMS_KEY` está configurada e que a service account
 * tem permissão de cifrar e decifrar. Não grava nada no Firestore — só
 * exercita o caminho que o wizard usa ao salvar a senha do certificado.
 *
 * Uso:
 *   GCLOUD_PROJECT=erp-softcode \
 *   FISCAL_SECRET_KMS_KEY=<recurso da chave> \
 *   npx tsx src/scripts/kms-fiscal-smoke.ts
 */

import { decryptToken, encryptToken, isEncryptedToken } from "../lib/token-encryption";

async function main(): Promise<void> {
  const plaintext = "senha-de-teste-do-certificado";

  const encrypted = await encryptToken(plaintext, "FISCAL_SECRET");
  if (!isEncryptedToken(encrypted)) {
    throw new Error("resultado sem o prefixo kms:v1:");
  }
  // A garantia que realmente importa: o texto puro não pode sobreviver no
  // valor gravado.
  if (encrypted.includes(plaintext)) {
    throw new Error("texto puro vazou no ciphertext");
  }

  const roundTrip = await decryptToken(encrypted, "FISCAL_SECRET");
  if (roundTrip !== plaintext) {
    throw new Error("round-trip divergente");
  }

  console.log("  prefixo ..........", encrypted.slice(0, 7));
  console.log("  tamanho cifrado ..", encrypted.length, "chars");
  console.log("  round-trip .......", "OK");
  console.log("\nKMS fiscal funcionando.");
}

main().catch((error) => {
  console.error("FALHOU:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
