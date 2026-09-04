/**
 * Audita (e opcionalmente corrige) a divergência entre `tenants/{id}.plan` e o
 * `planId` do dono da conta.
 *
 * Por que existe: o backend resolve o plano por `tenants/{id}.plan` PRIMEIRO
 * (`tenant-plan-policy.ts`), enquanto o frontend lê `users/{uid}.planId`. Os
 * dois passaram a ser escritos juntos pelo writer único a partir de
 * **2026-05-07 22:51 BRT** (commit `bbfd638d`); toda troca de plano ANTERIOR
 * atualizou só o documento do usuário e deixou o do tenant para trás.
 *
 * A divergência foi inofensiva enquanto ninguém lia `tenants.plan` para decidir
 * acesso a módulo. Deixou de ser quando o gate de capacidade entrou em
 * `enforce`: um tenant Enterprise com `plan: "pro"` guardado vê a tela do plano
 * certo e recebe 402 na API — sem que nada, nem no código nem na tela, revele
 * a contradição.
 *
 * **O projeto vem de `GCLOUD_PROJECT` e o default é DEV** (`erp-softcode`).
 * Produção exige a variável explícita — um script que escreve não pode herdar
 * o projeto do ambiente em silêncio.
 *
 * Uso (padrão é DRY-RUN — não escreve nada):
 *   cd apps/functions
 *   npx tsx src/scripts/audit-tenant-plan-drift.ts
 *   GCLOUD_PROJECT=erp-softcode-prod npx tsx src/scripts/audit-tenant-plan-drift.ts
 *
 * Um tenant só (recomendado na primeira corrida em produção):
 *   GCLOUD_PROJECT=erp-softcode-prod npx tsx src/scripts/audit-tenant-plan-drift.ts  *     --tenant=a1hubvLmdWjKojrGJbmc
 *
 * Aplicando:
 *   npx tsx src/scripts/audit-tenant-plan-drift.ts --tenant=abc --apply
 *
 * Idempotente: rodar de novo num tenant já corrigido não faz nada.
 */
import { getFirestore } from "firebase-admin/firestore";
import { initScriptAdmin } from "./_script-init";
import { normalizePlanTierId, type PlanTierId } from "../shared/plan-capabilities";

const PAGE_SIZE = 200;
const APPLY = process.argv.includes("--apply");
/** Corrigir um tenant por vez é o caminho prudente em produção. */
const ONLY_TENANT =
  process.argv.find((arg) => arg.startsWith("--tenant="))?.split("=")[1]?.trim() ||
  null;

interface Drift {
  tenantId: string;
  tenantName: string;
  storedTier: string;
  ownerTier: PlanTierId;
  ownerUid: string;
  ownerUpdatedAt: string;
}

/**
 * Dono do tenant = usuário `admin` mais antigo.
 *
 * Mesma estratégia do fallback de `tenant-plan-policy.ts`: ordenar por
 * `createdAt` em vez de filtrar por papel, porque a grafia do papel varia entre
 * tenants antigos ("admin", "ADMIN", "Admin").
 */
async function findOwner(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
): Promise<{ uid: string; planId: string; updatedAt: string } | null> {
  const snap = await db
    .collection("users")
    .where("tenantId", "==", tenantId)
    .orderBy("createdAt", "asc")
    .limit(10)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const planId = String(data.planId || "").trim();
    if (planId) {
      return {
        uid: doc.id,
        planId,
        updatedAt: String(data.planUpdatedAt || data.updatedAt || ""),
      };
    }
  }
  return null;
}

async function main(): Promise<void> {
  // Antes de qualquer coisa: dizer em QUE BASE isto está falando. Um script que
  // escreve herdando o projeto do ambiente em silêncio é como o "não encontrado"
  // acontece — a busca roda na base errada e o resultado parece um dado limpo.
  const projectId = initScriptAdmin();
  const db = getFirestore();

  console.log(
    `=== audit-tenant-plan-drift: ${APPLY ? "APLICANDO" : "dry-run (nada será escrito)"} ===`,
  );
  console.log(`projeto: ${projectId}`);

  if (ONLY_TENANT) {
    console.log(`escopo: apenas ${ONLY_TENANT}`);
  }

  const drifts: Drift[] = [];
  let scanned = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("tenants").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      if (ONLY_TENANT && doc.id !== ONLY_TENANT) continue;
      scanned += 1;
      const data = doc.data() as Record<string, unknown>;
      const storedTier =
        normalizePlanTierId(data.plan) ||
        normalizePlanTierId(data.planTier) ||
        normalizePlanTierId(data.tier);

      const owner = await findOwner(db, doc.id);
      if (!owner) continue;

      const ownerTier = normalizePlanTierId(owner.planId);
      // Só conta como divergência quando os DOIS lados resolvem para um tier
      // conhecido e diferente. `planId` de preço customizado não normaliza, e
      // ali o resolvedor já cai na cadeia de fallback — não há o que corrigir.
      if (!ownerTier || !storedTier || storedTier === ownerTier) continue;

      drifts.push({
        tenantId: doc.id,
        tenantName: String(data.name || ""),
        storedTier,
        ownerTier,
        ownerUid: owner.uid,
        ownerUpdatedAt: owner.updatedAt,
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.size < PAGE_SIZE) break;
  }

  if (ONLY_TENANT && scanned === 0) {
    console.log("");
    console.log(`Tenant ${ONLY_TENANT} NAO existe no projeto ${projectId}.`);
    console.log("Se ele e de producao, repita com:");
    console.log(
      "  GCLOUD_PROJECT=erp-softcode-prod npx tsx " +
        `src/scripts/audit-tenant-plan-drift.ts --tenant=${ONLY_TENANT}`,
    );
    return;
  }

  console.log(`\ntenants varridos: ${scanned}`);
  console.log(`divergências encontradas: ${drifts.length}\n`);

  for (const drift of drifts) {
    console.log(
      `  ${drift.tenantId}  "${drift.tenantName}"\n` +
        `    tenants.plan = ${drift.storedTier}   users.planId = ${drift.ownerTier}` +
        `   (dono ${drift.ownerUid}, alterado em ${drift.ownerUpdatedAt || "?"})`,
    );
  }

  if (drifts.length === 0) {
    console.log("Nada a corrigir.");
    return;
  }

  if (!APPLY) {
    console.log(
      "\nDry-run. Confira a lista acima ANTES de aplicar — o script assume que o\n" +
        "documento do USUÁRIO é o correto, o que vale para a divergência histórica\n" +
        "(troca de plano anterior ao writer único). Se algum tenant foi rebaixado de\n" +
        "propósito e só o tenant doc foi atualizado, aplicar aqui o promoveria de volta.\n" +
        "Para aplicar: npx tsx src/scripts/audit-tenant-plan-drift.ts --apply",
    );
    return;
  }

  let updated = 0;
  for (const drift of drifts) {
    await db.collection("tenants").doc(drift.tenantId).set(
      {
        plan: drift.ownerTier,
        planId: drift.ownerTier,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    updated += 1;
    console.log(`  corrigido: ${drift.tenantId} -> ${drift.ownerTier}`);
  }

  console.log(`\n${updated} tenant(s) corrigido(s).`);
  console.log(
    "O cache de plano tem TTL de 30s por instância — a mudança vale no próximo ciclo.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("audit-tenant-plan-drift falhou:", err);
    process.exit(1);
  });
