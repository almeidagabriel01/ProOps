import type { Request, Response } from "express";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { getTenantDocCached } from "../../lib/tenant-doc-cache";
import { demoTenantIdForNiche } from "../../shared/demo-tenant";

/**
 * GET /v1/wallets/options
 *
 * As carteiras da empresa para um seletor: só id, nome, situação e qual é a
 * padrão, nunca o saldo. Quem monta proposta ou contrato escolhe a carteira que
 * recebe sem ter acesso ao financeiro, e as rules de `wallets` só deixam ler o
 * documento inteiro (com o saldo) quem vê Lançamentos ou Carteiras.
 *
 * Aberta a qualquer pessoa da empresa, como `GET /price-tables/options`. A
 * conta free lê as carteiras do tenant de exemplo do nicho dela, que é o que
 * as rules já lhe mostravam.
 */

export interface WalletOption {
  id: string;
  name: string;
  isDefault: boolean;
  status: "active" | "archived";
}

const MAX_WALLET_OPTIONS = 200;

export function toWalletOptions(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>,
): WalletOption[] {
  return docs
    .map((d) => ({
      id: d.id,
      name: String(d.data.name ?? "").trim(),
      isDefault: d.data.isDefault === true,
      status: (d.data.status === "archived" ? "archived" : "active") as WalletOption["status"],
    }))
    .filter((w) => w.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

async function resolveTenantId(req: Request): Promise<string | null> {
  if (String(req.user?.role || "").toLowerCase() === "free") {
    const accountTenantId = req.user?.tenantId;
    const account = accountTenantId ? await getTenantDocCached(accountTenantId) : null;
    return demoTenantIdForNiche(account?.data?.niche);
  }
  return req.user?.tenantId || null;
}

export async function listWalletOptions(req: Request, res: Response) {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });

    const snap = await db
      .collection("wallets")
      .where("tenantId", "==", tenantId)
      .limit(MAX_WALLET_OPTIONS)
      .get();

    const wallets = toWalletOptions(
      snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> })),
    );
    return res.json({ wallets });
  } catch (error) {
    logger.error("wallet_options_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao carregar as carteiras." });
  }
}
