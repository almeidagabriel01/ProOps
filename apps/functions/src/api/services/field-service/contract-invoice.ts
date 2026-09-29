import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { resolveTenantCapabilities } from "../../../lib/tenant-capabilities";
import { getFiscalSettings } from "../fiscal/fiscal-settings.service";
import { issueFromTransaction } from "../fiscal/invoice-issue.service";
import { SERVICE_CONTRACTS_COLLECTION } from "./contract-model";

/**
 * A NFS-e da mensalidade, emitida quando o lançamento do mês vira pago, nos
 * contratos com a chave `issueNfse` ligada. Chamada pelo `onTransactionTotals`,
 * que vê toda baixa (webhook do Asaas, edição, baixa em lote), então não há
 * caminho de pagamento que escape.
 *
 * O gatilho pode ser entregue mais de uma vez. A trava é um documento por
 * lançamento (`contract_invoice_claims/{transactionId}`), gravado com
 * `create` ANTES de emitir: a segunda entrega encontra a trava e para. Se a
 * emissão falhar, a trava fica e a empresa emite pelo botão do lançamento,
 * que mostra o que faltou.
 */

export const CONTRACT_INVOICE_CLAIMS_COLLECTION = "contract_invoice_claims";

export type ContractInvoiceOutcome =
  | "issued"
  | "gaps"
  | "not_enabled"
  | "no_fiscal"
  | "not_ready"
  | "already_claimed"
  | "failed";

export async function issueContractChargeInvoice(
  transactionId: string,
  after: Record<string, unknown>,
): Promise<ContractInvoiceOutcome> {
  const tenantId = String(after.tenantId ?? "");
  const contractId = String(after.serviceContractId);
  try {
    const contract = (await db.collection(SERVICE_CONTRACTS_COLLECTION).doc(contractId).get()).data();
    if (!contract || contract.tenantId !== tenantId || contract.issueNfse !== true) return "not_enabled";

    const { capabilities } = await resolveTenantCapabilities(tenantId);
    if (!capabilities.fiscal) return "no_fiscal";
    const settings = await getFiscalSettings(tenantId);
    if (!settings || settings.status !== "ready") return "not_ready";

    try {
      await db.collection(CONTRACT_INVOICE_CLAIMS_COLLECTION).doc(transactionId).create({
        tenantId,
        transactionId,
        serviceContractId: contractId,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      // 6 = ALREADY_EXISTS. Outra falha sobe: sem a trava, não se emite.
      const code = (error as { code?: unknown }).code;
      if (code === 6 || String((error as Error).message).includes("ALREADY_EXISTS")) return "already_claimed";
      throw error;
    }

    const result = await issueFromTransaction(tenantId, transactionId, { createdBy: "system" });
    if (result.gaps.length > 0) {
      logger.warn("service_contract_invoice_gaps", {
        tenantId,
        transactionId,
        campos: result.gaps.map((gap) => `${gap.scope}.${gap.field}`).slice(0, 10),
      });
      return "gaps";
    }
    return "issued";
  } catch (error) {
    logger.error("service_contract_invoice_failed", {
      tenantId,
      transactionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }
}
