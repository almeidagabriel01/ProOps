/**
 * Alinha as custom claims de um usuário (role, tenantId, masterId) ao doc
 * `users/{uid}`, que é a fonte que o Firestore e o backend já usam quando a
 * claim falta.
 *
 * Existe porque uma conta montada à mão no Firestore (papel e tenant trocados
 * no doc, claim esquecida) usa o ERP inteiro e só falha onde a regra lê a
 * claim: foi o upload de imagem da conta de demonstração em produção
 * (`storage/unauthorized`).
 *
 * Por padrão só DIAGNOSTICA: imprime se cada claim bate com o doc, sem
 * alterar nada. Com `--apply`, grava as claims (preservando as que já
 * existem, porque setCustomUserClaims substitui o objeto inteiro) e revoga os
 * refresh tokens, para o próximo token já sair com elas. Doc com papel `free`
 * não é promovido.
 *
 * Uso:
 *   cd apps/functions
 *   GCLOUD_PROJECT=erp-softcode-prod npx ts-node src/scripts/repair-user-claims.ts <email-ou-uid>
 *   GCLOUD_PROJECT=erp-softcode-prod npx ts-node src/scripts/repair-user-claims.ts <email-ou-uid> --apply
 */

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initScriptAdmin } from "./_script-init";

const ALIGNED_KEYS = ["role", "tenantId", "masterId"] as const;

async function main(): Promise<void> {
  const projectId = initScriptAdmin();
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const target = String(process.env.TARGET || args.find((a) => !a.startsWith("--")) || "").trim();
  if (!target) {
    throw new Error("Informe o alvo: npx ts-node ... <email-ou-uid> [--apply]");
  }

  const auth = getAuth();
  const db = getFirestore();
  const user = target.includes("@")
    ? await auth.getUserByEmail(target)
    : await auth.getUser(target);

  const userDoc = await db.collection("users").doc(user.uid).get();
  if (!userDoc.exists) {
    throw new Error(`users/${user.uid} não existe em ${projectId}.`);
  }
  const data = userDoc.data() || {};
  const docRole = String(data.role || "");
  const docTenantId = String(data.tenantId || data.companyId || "");
  const docMasterId = String(data.masterId || user.uid);
  const expected: Record<(typeof ALIGNED_KEYS)[number], string> = {
    role: docRole,
    tenantId: docTenantId,
    masterId: docMasterId,
  };

  const claims = (user.customClaims || {}) as Record<string, unknown>;
  console.log(`Projeto: ${projectId}`);
  console.log(`Usuário: ${user.uid}`);
  console.log(`Chaves nas claims: ${Object.keys(claims).join(", ") || "(nenhuma)"}`);
  console.log(`Papel no doc: ${docRole || "(vazio)"} | papel na claim: ${String(claims.role ?? "(ausente)")}`);
  const mismatched = ALIGNED_KEYS.filter((key) => String(claims[key] ?? "") !== expected[key]);
  for (const key of ALIGNED_KEYS) {
    console.log(`  ${key}: ${mismatched.includes(key) ? "DIVERGE do doc" : "ok"}`);
  }

  if (docTenantId) {
    const usage = await db.collection("tenant_storage_usage").doc(docTenantId).get();
    console.log(
      `Uso de armazenamento: ${usage.exists ? `overQuota=${usage.data()?.overQuota === true}` : "sem doc (nada contado)"}`,
    );
  }

  if (mismatched.length === 0) {
    console.log("Nada a fazer: as claims já batem com o doc.");
    return;
  }
  if (!docTenantId || !docRole || docRole.toLowerCase() === "free") {
    console.log("O doc não tem papel pago ou tenant: nada é promovido por este script.");
    return;
  }
  if (!apply) {
    console.log("Diagnóstico apenas. Rode de novo com --apply para gravar as claims.");
    return;
  }

  await auth.setCustomUserClaims(user.uid, { ...claims, ...expected });
  await auth.revokeRefreshTokens(user.uid);
  console.log("Claims gravadas e sessões revogadas: o usuário entra de novo e o próximo token já as traz.");
}

main().catch((err: Error) => {
  console.error("Erro fatal:", err.message);
  process.exit(1);
});
