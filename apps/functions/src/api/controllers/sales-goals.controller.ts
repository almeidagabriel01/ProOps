import { Request, Response } from "express";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { isTenantAdminRole } from "../../lib/auth-context";
import {
  SALES_GOALS_COLLECTION,
  SalesGoalsInputSchema,
  computeGoalProgress,
  goalsDocId,
  isValidMonth,
  monthWindowUtc,
  type SoldProposal,
} from "../services/sales-goals";

/**
 * Metas de vendas (capacidade `salesGoals`, montada por prefixo em
 * `sales-goals.routes.ts`). Sem pageId: o dono e os administradores definem as
 * metas e veem a equipe; o membro vê só o próprio progresso. O tenant vem
 * sempre de `req.user.tenantId`.
 */

const PEOPLE_LIMIT = 200;
const PROPOSALS_LIMIT = 2000;

function isAdmin(req: Request): boolean {
  return isTenantAdminRole(String(req.user?.role || "").toUpperCase());
}

async function loadPeople(tenantId: string): Promise<Array<{ id: string; name: string }>> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).limit(PEOPLE_LIMIT).get();
  return snap.docs
    .filter((doc) => String(doc.data().role || "").toUpperCase() !== "SUPERADMIN")
    .map((doc) => ({ id: doc.id, name: String(doc.data().name || doc.data().email || "Sem nome") }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function loadGoals(tenantId: string, month: string) {
  const snap = await db.collection(SALES_GOALS_COLLECTION).doc(goalsDocId(tenantId, month)).get();
  const data = snap.data();
  return {
    companyTarget: typeof data?.companyTarget === "number" ? data.companyTarget : null,
    targets: (data?.targets as Record<string, number> | undefined) ?? {},
  };
}

/** Propostas aprovadas no mês (fuso de Brasília), pela data da aprovação. */
async function loadSoldProposals(tenantId: string, month: string): Promise<SoldProposal[]> {
  const { start, end } = monthWindowUtc(month);
  // orderBy explícito ASC: é a direção do índice (tenantId, approvedAt).
  const snap = await db
    .collection("proposals")
    .where("tenantId", "==", tenantId)
    .where("approvedAt", ">=", start)
    .where("approvedAt", "<", end)
    .orderBy("approvedAt", "asc")
    .limit(PROPOSALS_LIMIT)
    .get();
  return snap.docs.map((doc) => doc.data() as SoldProposal);
}

function readMonth(req: Request, res: Response): string | null {
  const month = req.query.month;
  if (!isValidMonth(month)) {
    res.status(400).json({ message: "Mês inválido. Use AAAA-MM." });
    return null;
  }
  return month;
}

/** GET /v1/sales-goals?month=AAAA-MM: as metas do mês, para a tela de configuração. */
export async function getSalesGoals(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!isAdmin(req)) return res.status(403).json({ message: "Só o administrador define as metas." });
    const month = readMonth(req, res);
    if (!month) return;
    const [goals, people] = await Promise.all([loadGoals(tenantId, month), loadPeople(tenantId)]);
    return res.json({ month, ...goals, people });
  } catch (error) {
    logger.error("sales_goals_get_failed", { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ message: "Erro ao carregar as metas." });
  }
}

/** PUT /v1/sales-goals: grava as metas de um mês (só administrador). */
export async function updateSalesGoals(req: Request, res: Response) {
  const parsed = SalesGoalsInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  }
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!isAdmin(req)) return res.status(403).json({ message: "Só o administrador define as metas." });

    const people = new Set((await loadPeople(tenantId)).map((p) => p.id));
    const targets: Record<string, number> = {};
    for (const [uid, value] of Object.entries(parsed.data.targets)) {
      if (!people.has(uid)) {
        return res.status(400).json({ message: "Meta para quem não é da empresa." });
      }
      // Zero é "sem meta": não guarda.
      if (value > 0) targets[uid] = value;
    }

    const doc = {
      tenantId,
      month: parsed.data.month,
      companyTarget: parsed.data.companyTarget && parsed.data.companyTarget > 0 ? parsed.data.companyTarget : null,
      targets,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.uid,
    };
    await db.collection(SALES_GOALS_COLLECTION).doc(goalsDocId(tenantId, parsed.data.month)).set(doc);
    return res.json({ month: doc.month, companyTarget: doc.companyTarget, targets: doc.targets });
  } catch (error) {
    logger.error("sales_goals_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ message: "Erro ao salvar as metas." });
  }
}

/**
 * GET /v1/sales-goals/progress?month=AAAA-MM. O administrador recebe a
 * empresa e a equipe; o membro, só o próprio número.
 */
export async function getSalesGoalsProgress(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const uid = req.user?.uid;
    if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
    const month = readMonth(req, res);
    if (!month) return;

    const [goals, proposals, people] = await Promise.all([
      loadGoals(tenantId, month),
      loadSoldProposals(tenantId, month),
      loadPeople(tenantId),
    ]);
    const progress = computeGoalProgress(proposals, goals, people);

    if (isAdmin(req)) return res.json({ month, scope: "company", ...progress });

    const mine = progress.people.find((p) => p.id === uid);
    return res.json({
      month,
      scope: "mine",
      target: goals.targets[uid] ?? null,
      achieved: mine?.achieved ?? 0,
      count: mine?.count ?? 0,
    });
  } catch (error) {
    logger.error("sales_goals_progress_failed", { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ message: "Erro ao calcular as metas." });
  }
}

/** GET /v1/sales-goals/sellers: quem pode ser vendedor de uma proposta. */
export async function listSellers(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    return res.json({ people: await loadPeople(tenantId) });
  } catch (error) {
    logger.error("sales_goals_sellers_failed", { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ message: "Erro ao carregar a equipe." });
  }
}
