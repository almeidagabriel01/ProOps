import { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { hasPagePermission, resolveUserAndTenant } from "../../lib/auth-helpers";
import { MAX_ROWS_PER_REQUEST } from "../services/import/import-model";
import {
  ImportError,
  importClients,
  importProducts,
  importServices,
  type ImportContext,
  type ImportKind,
} from "../services/import/import.service";

/**
 * Importação por planilha de contatos, produtos e serviços. Pede a mesma
 * permissão de criar do cadastro manual. `dryRun` só valida e marca repetido,
 * para a prévia; sem ele, grava as linhas válidas. A conta free nunca chega
 * aqui: é POST, e o `requireActiveSubscription` só deixa passar GET.
 */

const PAGE: Record<ImportKind, string> = { clients: "clients", products: "products", services: "services" };

const cell = z.union([z.string().max(5000), z.number(), z.null()]);
const BodySchema = z
  .object({
    rows: z.array(z.record(z.string().max(40), cell)).min(1).max(MAX_ROWS_PER_REQUEST),
    dryRun: z.boolean().optional(),
    /** Produto: aceitar "preço por metro" (o front manda conforme o nicho). */
    allowPerMeter: z.boolean().optional(),
  })
  .strict();

async function context(req: Request, kind: ImportKind): Promise<ImportContext> {
  const uid = req.user?.uid;
  const tenantId = req.user?.tenantId;
  if (!uid || !tenantId) throw new ImportError(403, "Tenant não identificado.");
  if (!(await hasPagePermission(req.user, PAGE[kind], "canCreate"))) {
    throw new ImportError(403, "Sem permissão para cadastrar aqui.");
  }
  const { masterRef, isSuperAdmin } = await resolveUserAndTenant(uid, req.user);
  return { tenantId, uid, ownerRef: masterRef, isSuperAdmin, requestId: req.requestId, route: req.path };
}

function handler(kind: ImportKind) {
  return async (req: Request, res: Response) => {
    const parsed = BodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: `Envie de 1 a ${MAX_ROWS_PER_REQUEST} linhas por vez.` });
    }
    const { rows, dryRun = false, allowPerMeter = false } = parsed.data;
    try {
      const ctx = await context(req, kind);
      const outcome =
        kind === "clients"
          ? await importClients(ctx, rows, dryRun)
          : kind === "products"
            ? await importProducts(ctx, rows, dryRun, { allowPerMeter })
            : await importServices(ctx, rows, dryRun);
      if (!dryRun) logger.info("import_committed", { tenantId: ctx.tenantId, kind, created: outcome.created });
      return res.json(outcome);
    } catch (error) {
      if (error instanceof ImportError) {
        return res.status(error.status).json({ message: error.message, ...(error.code ? { code: error.code } : {}) });
      }
      logger.error("import_failed", { kind, error: error instanceof Error ? error.message : String(error) });
      return res.status(500).json({ message: "Erro ao importar a planilha." });
    }
  };
}

/** POST /v1/clients/import */
export const importClientsHandler = handler("clients");
/** POST /v1/products/import */
export const importProductsHandler = handler("products");
/** POST /v1/services/import */
export const importServicesHandler = handler("services");
