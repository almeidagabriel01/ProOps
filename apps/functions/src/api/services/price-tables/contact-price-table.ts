import { tenantHasCapability } from "../../../lib/tenant-capabilities";
import {
  buildCapabilityDeniedMessage,
  resolvePlanCapabilityMode,
} from "../../middleware/require-plan-capability";
import { PriceTableError, assertPriceTableBelongsToTenant } from "./price-tables.service";

/**
 * O contato guarda a tabela dele em `clients.priceTableId` (ausente = tabela
 * padrão, o próprio catálogo). Este é o portão de quem grava o campo:
 *
 * - só contato do tipo cliente tem tabela (fornecedor e parceiro não compram);
 * - a tabela tem que ser da mesma empresa;
 * - escolher uma tabela pede o módulo no plano. A gravação do contato não
 *   passa pelo gate de `/v1/price-tables`, então confere aqui, no mesmo modo
 *   (`TENANT_PLAN_CAPABILITY_MODE`) do gate. Voltar para a tabela padrão
 *   (`null`) é sempre permitido: é o caminho de quem perdeu o plano.
 */

export function isPriceTableContact(types: readonly string[] | undefined): boolean {
  return (types ?? ["cliente"]).includes("cliente");
}

export async function validateContactPriceTable(
  tenantId: string,
  priceTableId: string,
  types: readonly string[] | undefined,
): Promise<void> {
  if (!isPriceTableContact(types)) {
    throw new PriceTableError(400, "Tabela de preço só vale para contato do tipo cliente.");
  }
  if (resolvePlanCapabilityMode() === "enforce" && !(await tenantHasCapability(tenantId, "priceTables"))) {
    throw new PriceTableError(
      402,
      buildCapabilityDeniedMessage("priceTables"),
      "PLAN_CAPABILITY_REQUIRED",
    );
  }
  await assertPriceTableBelongsToTenant(tenantId, priceTableId);
}
