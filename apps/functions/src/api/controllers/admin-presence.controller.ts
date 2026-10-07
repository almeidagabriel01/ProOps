import type { Request, Response } from "express";
import { db } from "../../init";
import { isSuperAdminClaim } from "../../lib/request-auth";
import { logger } from "../../lib/logger";
import { listTenantPresence } from "../../lib/tenant-presence";

/** Brasília não tem horário de verão desde 2019: o dia começa às 03:00 UTC. */
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Meia-noite de hoje em Brasília, em ISO UTC. */
export function startOfTodayBrasiliaIso(nowMs: number): string {
  const local = new Date(nowMs - BRASILIA_OFFSET_MS);
  const midnightLocalUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnightLocalUtc + BRASILIA_OFFSET_MS).toISOString();
}

/**
 * `GET /v1/admin/presence` — quem está online agora e quem passou pelo ERP
 * hoje, por empresa e por pessoa. Alimenta a tela "Online" do painel, que
 * consulta de novo a cada 30 segundos.
 */
export const listPresence = async (req: Request, res: Response) => {
  if (!isSuperAdminClaim(req)) return res.status(403).json({ message: "Permissão negada." });
  try {
    const nowMs = Date.now();
    const since = startOfTodayBrasiliaIso(nowMs);
    const entries = await listTenantPresence(since, nowMs);

    const names = new Map<string, string>();
    if (entries.length > 0) {
      const snaps = await db.getAll(...entries.map((e) => db.collection("tenants").doc(e.tenantId)));
      for (const snap of snaps) {
        if (snap.exists) names.set(snap.id, String(snap.get("name") || ""));
      }
    }

    return res.json({
      now: new Date(nowMs).toISOString(),
      since,
      tenants: entries.map((entry) => ({ ...entry, tenantName: names.get(entry.tenantId) || entry.tenantId })),
    });
  } catch (error: unknown) {
    logger.error("[listPresence] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao carregar quem está online." });
  }
};
