import { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { getPageScope, hasPagePermission } from "../../lib/auth-helpers";
import { demoTenantIdForNiche } from "../../shared/demo-tenant";
import { getTenantDocCached } from "../../lib/tenant-doc-cache";
import { DRE_GROUPS, type DreGroup } from "../services/finance-reports/dre-model";
import { DreError, buildDre } from "../services/finance-reports/dre.service";
import {
  CategoryError,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../services/finance-reports/transaction-categories";

/**
 * DRE e categorias de lançamento. Montadas sob `/transactions`, herdam o gate
 * `financial` e a leitura do modo demo; seguem a permissão de Lançamentos
 * (`transactions`): ver para ler, criar para cadastrar categoria (o "criar
 * nova" do formulário), editar para renomear ou mudar o grupo, excluir para
 * tirar da lista.
 *
 * A conta free (demonstração) lê o DRE e as categorias do tenant de exemplo:
 * o dela está vazio, e os dados de exemplo já são legíveis por ela pelas
 * rules. Escrever continua bloqueado (o `requireActiveSubscription` só deixa
 * passar GET).
 */

type Action = "canView" | "canCreate" | "canEdit" | "canDelete";

class ForbiddenError extends Error {}

async function requireTransactions(req: Request, action: Action): Promise<string> {
  if (String(req.user?.role || "").toLowerCase() === "free") {
    if (action !== "canView") throw new ForbiddenError("Conta de demonstração: somente leitura.");
    // A demonstração é a do nicho da conta.
    const accountTenantId = req.user?.tenantId;
    const account = accountTenantId ? await getTenantDocCached(accountTenantId) : null;
    return demoTenantIdForNiche(account?.data?.niche);
  }
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant não identificado.");
  if (!(await hasPagePermission(req.user, "transactions", action))) {
    throw new ForbiddenError("Sem permissão para o financeiro.");
  }
  return tenantId;
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof ForbiddenError) return res.status(403).json({ message: error.message });
  if (error instanceof CategoryError || error instanceof DreError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

const groupSchema = z
  .string()
  .refine((value): value is DreGroup => value in DRE_GROUPS, "Grupo do DRE inválido.") as unknown as z.ZodType<DreGroup>;

const nameSchema = z.string().trim().min(1, "Informe o nome.").max(100).transform((v) => v.replace(/\s+/g, " "));

const CreateSchema = z
  .object({ name: nameSchema, kind: z.enum(["income", "expense"]), group: groupSchema.optional() })
  .strict();

const UpdateSchema = z
  .object({ name: nameSchema.optional(), group: groupSchema.optional() })
  .strict()
  .refine((v) => v.name !== undefined || v.group !== undefined, "Nada para alterar.");

/** GET /v1/transactions/categories */
export async function getTransactionCategories(req: Request, res: Response) {
  try {
    const tenantId = await requireTransactions(req, "canView");
    return res.json({ categories: await listCategories(tenantId) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar as categorias.", "transaction_categories_list_failed");
  }
}

/** POST /v1/transactions/categories */
export async function createTransactionCategory(req: Request, res: Response) {
  const parsed = CreateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  try {
    const tenantId = await requireTransactions(req, "canCreate");
    return res.status(201).json({ category: await createCategory(tenantId, parsed.data) });
  } catch (error) {
    return fail(res, error, "Erro ao criar a categoria.", "transaction_category_create_failed");
  }
}

/** PUT /v1/transactions/categories/:id */
export async function updateTransactionCategory(req: Request, res: Response) {
  const parsed = UpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  try {
    const tenantId = await requireTransactions(req, "canEdit");
    return res.json(await updateCategory(tenantId, String(req.params.id), parsed.data));
  } catch (error) {
    return fail(res, error, "Erro ao alterar a categoria.", "transaction_category_update_failed");
  }
}

/** DELETE /v1/transactions/categories/:id */
export async function deleteTransactionCategory(req: Request, res: Response) {
  try {
    const tenantId = await requireTransactions(req, "canDelete");
    await deleteCategory(tenantId, String(req.params.id));
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir a categoria.", "transaction_category_delete_failed");
  }
}

const DreQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  basis: z.enum(["cash", "accrual"]).default("cash"),
});

/** GET /v1/transactions/dre?from=YYYY-MM&to=YYYY-MM&basis=cash|accrual */
export async function getDre(req: Request, res: Response) {
  const parsed = DreQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Período inválido." });
  try {
    const tenantId = await requireTransactions(req, "canView");
    // O DRE soma receita e despesa da empresa inteira: com o alcance de
    // Lançamentos restrito ("só receitas", "só as minhas vendas"), ele
    // revelaria o que a lista esconde.
    if ((await getPageScope(req.user, "transactions")) !== "all") {
      return res.status(403).json({ message: "O DRE é de quem vê todos os lançamentos." });
    }
    return res.json({ dre: await buildDre(tenantId, parsed.data) });
  } catch (error) {
    return fail(res, error, "Erro ao montar o DRE.", "dre_build_failed");
  }
}
