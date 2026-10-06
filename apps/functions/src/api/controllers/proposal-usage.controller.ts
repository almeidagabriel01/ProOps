import { Request, Response } from "express";
import { db } from "../../init";
import { hasPagePermission } from "../../lib/auth-helpers";
import { logger } from "../../lib/logger";
import { isClientUsed } from "../services/proposal-usage.service";

/**
 * GET /v1/proposals/usage?kind=client|product|service&id=...
 *
 * Diz se um contato, produto ou serviço está em alguma proposta, para a tela
 * recusar a exclusão na hora. Antes a consulta era direta no Firestore, e as
 * rules passaram a exigir a permissão de ver propostas: o membro que cuida do
 * catálogo ou dos contatos não precisa ler proposta nenhuma para saber isso.
 * A resposta é só um booleano, sem nada da proposta.
 */

type UsageKind = "client" | "product" | "service";

const PAGE_BY_KIND: Record<UsageKind, string> = {
  client: "clients",
  product: "products",
  service: "services",
};

function parseKind(value: unknown): UsageKind | null {
  return value === "client" || value === "product" || value === "service" ? value : null;
}


/**
 * Mesmo critério do método antigo do front: o índice `productRefs` só vale
 * quando TODA proposta da empresa já o tem; antes do backfill, varre os itens.
 */
async function isItemUsed(tenantId: string, itemId: string, itemType: "product" | "service") {
  const tenantProposals = db.collection("proposals").where("tenantId", "==", tenantId);
  const [total, indexed] = await Promise.all([
    tenantProposals.count().get(),
    tenantProposals.where("productRefsIndexed", "==", true).count().get(),
  ]);

  if (indexed.data().count === total.data().count) {
    const used = await tenantProposals
      .where("productRefs", "array-contains", `${itemType}:${itemId}`)
      .limit(1)
      .get();
    return !used.empty;
  }

  const snap = await tenantProposals.select("products").get();
  return snap.docs.some((doc) => {
    const products = doc.data().products;
    return (
      Array.isArray(products) &&
      products.some(
        (p: { productId?: string; itemType?: string }) =>
          p?.productId === itemId && (p.itemType || "product") === itemType,
      )
    );
  });
}

export async function getProposalUsage(req: Request, res: Response) {
  const kind = parseKind(req.query.kind);
  const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
  if (!kind || !id) {
    return res.status(400).json({ message: "Parâmetros inválidos." });
  }

  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });

  const allowed =
    (await hasPagePermission(req.user, PAGE_BY_KIND[kind], "canView")) ||
    (await hasPagePermission(req.user, "proposals", "canView"));
  if (!allowed) {
    return res.status(403).json({ message: "Sem permissão para esta consulta." });
  }

  try {
    const used =
      kind === "client" ? await isClientUsed(tenantId, id) : await isItemUsed(tenantId, id, kind);
    return res.json({ used });
  } catch (error) {
    logger.error("proposal_usage_failed", {
      tenantId,
      kind,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Não foi possível verificar as propostas." });
  }
}
