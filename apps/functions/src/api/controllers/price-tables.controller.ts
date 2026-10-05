import type { Request, Response } from "express";
import { hasPagePermission } from "../../lib/auth-helpers";
import { logger } from "../../lib/logger";
import { getTenantDocCached } from "../../lib/tenant-doc-cache";
import { demoTenantIdForNiche } from "../../shared/demo-tenant";
import {
  CreatePriceTableSchema,
  UpdatePriceTableSchema,
  toPriceTableOption,
} from "../services/price-tables/price-table-model";
import {
  PriceTableError,
  createPriceTable,
  deletePriceTable,
  getPriceTable,
  listPriceTables,
  updatePriceTable,
} from "../services/price-tables/price-tables.service";

/**
 * Tabelas de preço (`/v1/price-tables`, gate `priceTables`: Pro e Enterprise).
 *
 * Seguem a permissão de Produtos, sem pageId próprio: ver para listar, criar,
 * editar e excluir para as respectivas ações. Duas leituras ficam abertas a
 * qualquer pessoa da empresa, porque o preço da tabela vale na proposta de
 * quem quer que a monte: `GET /price-tables/options` (nomes, para o seletor
 * do cadastro do cliente) e `GET /price-tables/:id` (a tabela de um cliente).
 *
 * A conta free (demonstração) lê as tabelas do tenant de exemplo do nicho
 * dela, como o DRE: a dela está vazia. Escrever continua bloqueado (o
 * `requireActiveSubscription` só deixa passar GET; aqui recusa de novo).
 */

type Action = "canView" | "canCreate" | "canEdit" | "canDelete";

class ForbiddenError extends Error {}

async function resolveTenant(req: Request, action: Action | null): Promise<string> {
  if (String(req.user?.role || "").toLowerCase() === "free") {
    if (action !== null && action !== "canView") {
      throw new ForbiddenError("Conta de demonstração: somente leitura.");
    }
    const accountTenantId = req.user?.tenantId;
    const account = accountTenantId ? await getTenantDocCached(accountTenantId) : null;
    return demoTenantIdForNiche(account?.data?.niche);
  }
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant não identificado.");
  if (action !== null && !(await hasPagePermission(req.user, "products", action))) {
    throw new ForbiddenError(
      action === "canView"
        ? "Sem permissão para ver as tabelas de preço."
        : "Sem permissão para alterar as tabelas de preço.",
    );
  }
  return tenantId;
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof ForbiddenError) return res.status(403).json({ message: error.message });
  if (error instanceof PriceTableError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message || "Dados inválidos.";
}

/** GET /v1/price-tables */
export async function listPriceTablesHandler(req: Request, res: Response) {
  try {
    const tenantId = await resolveTenant(req, "canView");
    return res.json({ priceTables: await listPriceTables(tenantId) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar as tabelas de preço.", "price_tables_list_failed");
  }
}

/** GET /v1/price-tables/options */
export async function listPriceTableOptionsHandler(req: Request, res: Response) {
  try {
    const tenantId = await resolveTenant(req, null);
    const tables = await listPriceTables(tenantId);
    return res.json({ options: tables.map(toPriceTableOption) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar as tabelas de preço.", "price_tables_options_failed");
  }
}

/** GET /v1/price-tables/:id */
export async function getPriceTableHandler(req: Request, res: Response) {
  try {
    const tenantId = await resolveTenant(req, null);
    return res.json({ priceTable: await getPriceTable(tenantId, String(req.params.id)) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar a tabela de preço.", "price_table_get_failed");
  }
}

/** POST /v1/price-tables */
export async function createPriceTableHandler(req: Request, res: Response) {
  try {
    const tenantId = await resolveTenant(req, "canCreate");
    const parsed = CreatePriceTableSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
    const priceTable = await createPriceTable(tenantId, req.user!.uid, parsed.data);
    return res.status(201).json({ priceTable });
  } catch (error) {
    return fail(res, error, "Erro ao criar a tabela de preço.", "price_table_create_failed");
  }
}

/** PUT /v1/price-tables/:id */
export async function updatePriceTableHandler(req: Request, res: Response) {
  try {
    const tenantId = await resolveTenant(req, "canEdit");
    const parsed = UpdatePriceTableSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
    const priceTable = await updatePriceTable(
      tenantId,
      String(req.params.id),
      req.user!.uid,
      parsed.data,
    );
    return res.json({ priceTable });
  } catch (error) {
    return fail(res, error, "Erro ao salvar a tabela de preço.", "price_table_update_failed");
  }
}

/** DELETE /v1/price-tables/:id */
export async function deletePriceTableHandler(req: Request, res: Response) {
  try {
    const tenantId = await resolveTenant(req, "canDelete");
    await deletePriceTable(tenantId, String(req.params.id));
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir a tabela de preço.", "price_table_delete_failed");
  }
}
