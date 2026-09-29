import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { runRotatingCursor } from "../../../lib/cron-iteration";
import { resolveTenantCapabilities } from "../../../lib/tenant-capabilities";
import { notifyTechnician, syncOrderAgenda } from "../../controllers/field-service.controller";
import { SERVICE_CONTRACTS_COLLECTION, todayInBrazil } from "./contract-model";
import { billContract, openContractVisit, readContract, suspendContractForPlan } from "./contract.service";
import { SERVICE_ORDERS_COLLECTION } from "./field-service-model";

/**
 * A rotina diária dos contratos: para cada contrato ativo, lança as
 * mensalidades que entraram na janela, abre a visita preventiva da vez e,
 * se a empresa perdeu o módulo ou o financeiro, suspende e avisa.
 *
 * Compartilhada pelo cron (`processServiceContracts`) e pelo endpoint interno
 * de depuração, que roda com `dryRun` sem gravar nada.
 */

const PAGE_SIZE = 100;
/** Prazo de trabalho, com folga até o timeout de 540s. O resto fica para amanhã, de onde parou. */
const BUDGET_MS = 420_000;

export interface ContractRunResult {
  dryRun: boolean;
  today: string;
  contracts: number;
  charges: number;
  alreadyBilled: number;
  visits: number;
  ended: number;
  suspended: number;
  errors: number;
  completedCycle: boolean;
}

export async function runServiceContracts(options: {
  dryRun: boolean;
  now?: Date;
  /** `null` roda do início sem gravar cursor (execução manual). */
  cursorId?: string | null;
}): Promise<ContractRunResult> {
  const today = todayInBrazil(options.now);
  const result: ContractRunResult = {
    dryRun: options.dryRun,
    today,
    contracts: 0,
    charges: 0,
    alreadyBilled: 0,
    visits: 0,
    ended: 0,
    suspended: 0,
    errors: 0,
    completedCycle: false,
  };

  // A capacidade é por empresa: uma leitura por empresa por execução.
  const capabilityCache = new Map<string, { fieldService: boolean; financial: boolean }>();
  const capabilitiesOf = async (tenantId: string) => {
    let cached = capabilityCache.get(tenantId);
    if (!cached) {
      const { capabilities } = await resolveTenantCapabilities(tenantId);
      cached = { fieldService: Boolean(capabilities.fieldService), financial: Boolean(capabilities.financial) };
      capabilityCache.set(tenantId, cached);
    }
    return cached;
  };

  const { completedCycle } = await runRotatingCursor({
    db,
    cursorId: options.dryRun ? null : (options.cursorId ?? null),
    collectionName: SERVICE_CONTRACTS_COLLECTION,
    baseQuery: db.collection(SERVICE_CONTRACTS_COLLECTION).where("status", "==", "active"),
    pageSize: PAGE_SIZE,
    deadlineMs: Date.now() + BUDGET_MS,
    processPage: async (docs) => {
      for (const doc of docs) {
        result.contracts += 1;
        const contract = readContract(doc.id, doc.data());
        try {
          const caps = await capabilitiesOf(contract.tenantId);
          if (!caps.fieldService || !caps.financial) {
            result.suspended += 1;
            if (!options.dryRun) {
              await suspendContractForPlan(contract, caps.fieldService ? "o financeiro" : "contratos de manutenção");
            }
            continue;
          }

          const billing = await billContract(contract.id, today, options.dryRun);
          result.charges += billing.created.length;
          result.alreadyBilled += billing.skipped.length;
          if (billing.ended) result.ended += 1;

          const orderId = await openContractVisit(contract.id, today, options.dryRun);
          if (orderId) {
            result.visits += 1;
            if (!options.dryRun) await afterVisitCreated(orderId, contract.tenantId);
          }
        } catch (error) {
          result.errors += 1;
          logger.error("service_contract_run_failed", {
            contractId: contract.id,
            tenantId: contract.tenantId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  });

  result.completedCycle = completedCycle;
  logger.info("service_contracts_run", { ...result });
  return result;
}

/** A visita recém-aberta vai para a Agenda e o técnico é avisado, como na OS aberta pela tela. */
async function afterVisitCreated(orderId: string, tenantId: string): Promise<void> {
  await syncOrderAgenda(orderId, tenantId, "system");
  const created = (await db.collection(SERVICE_ORDERS_COLLECTION).doc(orderId).get()).data();
  if (created) await notifyTechnician({ tenantId, orderId, uid: "system", before: null, after: created });
}
