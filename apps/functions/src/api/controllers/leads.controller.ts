import { Request, Response } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../../init";
import { hasPagePermission } from "../../lib/auth-helpers";
import {
  enforceTenantPlanLimit,
  getTenantClientsUsage,
} from "../../lib/tenant-plan-policy";
import { buildClientSearchTokens } from "../../lib/search-tokens";
import {
  LeadInputSchema,
  LeadUpdateSchema,
  isLeadOpen,
} from "../services/crm-leads";

/**
 * Leads do CRM (`leads`): a oportunidade antes da proposta. Seguem a permissão
 * do CRM (pageId `kanban`) e a capacidade `crm`, montada por prefixo em
 * `crm.routes.ts`. O tenant vem sempre de `req.user.tenantId`.
 */
const COLLECTION = "leads";
const MAX_LEADS_LISTED = 500;

type LeadDoc = Record<string, unknown> & { tenantId?: string };

function toPublicLead(id: string, data: LeadDoc) {
  return {
    id,
    name: data.name,
    phone: data.phone ?? null,
    email: data.email ?? null,
    company: data.company ?? null,
    source: data.source ?? "outro",
    stage: data.stage ?? "novo",
    estimatedValue: data.estimatedValue ?? null,
    notes: data.notes ?? null,
    nextAction: data.nextAction ?? null,
    nextActionAt: data.nextActionAt ?? null,
    lostReason: data.lostReason ?? null,
    clientId: data.clientId ?? null,
    ownerId: data.ownerId ?? null,
    ownerName: data.ownerName ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/** Remove chaves `undefined` (o Firestore recusa) mantendo `null`, que limpa o campo. */
function compact(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
}

async function loadLeadOfTenant(leadId: string, tenantId: string) {
  const ref = db.collection(COLLECTION).doc(leadId);
  const snap = await ref.get();
  const data = snap.data() as LeadDoc | undefined;
  if (!snap.exists || data?.tenantId !== tenantId) return null;
  return { ref, data: data as LeadDoc };
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message || "Dados inválidos.";
}

/** GET /v1/leads */
export async function listLeads(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "kanban", "canView"))) {
      return res.status(403).json({ message: "Sem permissão para ver o CRM." });
    }

    // Só igualdade, ordenado em memória: evita índice composto para uma
    // coleção que tem teto por tenant.
    const snap = await db
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .limit(MAX_LEADS_LISTED)
      .get();

    const leads = snap.docs
      .map((doc) => toPublicLead(doc.id, doc.data() as LeadDoc))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

    return res.json({ leads });
  } catch (error) {
    console.error("listLeads Error:", error);
    return res.status(500).json({ message: "Erro ao carregar os leads." });
  }
}

/** POST /v1/leads */
export async function createLead(req: Request, res: Response) {
  const parsed = LeadInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });

  try {
    const tenantId = req.user?.tenantId;
    const uid = req.user?.uid;
    if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "kanban", "canCreate"))) {
      return res.status(403).json({ message: "Sem permissão para criar leads." });
    }

    const owner = await db.collection("users").doc(uid).get();
    const now = new Date().toISOString();
    const lead = compact({
      ...parsed.data,
      tenantId,
      ownerId: uid,
      ownerName: (owner.data()?.name as string | undefined) ?? null,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
    });
    const ref = await db.collection(COLLECTION).add(lead);

    return res.status(201).json({ lead: toPublicLead(ref.id, lead as LeadDoc) });
  } catch (error) {
    console.error("createLead Error:", error);
    return res.status(500).json({ message: "Erro ao salvar o lead." });
  }
}

/** PUT /v1/leads/:id */
export async function updateLead(req: Request, res: Response) {
  const parsed = LeadUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });

  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "kanban", "canEdit"))) {
      return res.status(403).json({ message: "Sem permissão para editar leads." });
    }

    const found = await loadLeadOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Lead não encontrado." });

    // "Convertido" só nasce pela conversão, que cria o contato; arrastar para a
    // coluna deixaria um lead convertido sem contato nenhum.
    if (parsed.data.stage === "convertido" && !found.data.clientId) {
      return res.status(400).json({ message: "Use \"Converter\" para transformar o lead em contato." });
    }

    // Texto enviado vazio limpa o campo (o schema o transforma em undefined).
    const cleared = Object.fromEntries(
      Object.entries((req.body ?? {}) as Record<string, unknown>)
        .filter(([, v]) => v === "")
        .map(([k]) => [k, null]),
    );
    const update = compact({ ...parsed.data, ...cleared, updatedAt: new Date().toISOString() });
    await found.ref.update(update);

    return res.json({ lead: toPublicLead(req.params.id, { ...found.data, ...update }) });
  } catch (error) {
    console.error("updateLead Error:", error);
    return res.status(500).json({ message: "Erro ao atualizar o lead." });
  }
}

/** DELETE /v1/leads/:id (apaga junto as atividades do lead) */
export async function deleteLead(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "kanban", "canDelete"))) {
      return res.status(403).json({ message: "Sem permissão para excluir leads." });
    }

    const found = await loadLeadOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Lead não encontrado." });

    const activities = await db
      .collection("activities")
      .where("tenantId", "==", tenantId)
      .where("leadId", "==", req.params.id)
      .limit(400)
      .get();

    const batch = db.batch();
    activities.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(found.ref);
    await batch.commit();

    return res.json({ success: true });
  } catch (error) {
    console.error("deleteLead Error:", error);
    return res.status(500).json({ message: "Erro ao excluir o lead." });
  }
}

/**
 * POST /v1/leads/:id/convert
 *
 * Transforma o lead em contato (ou reaproveita o contato já ligado) e marca o
 * lead como convertido. A proposta é criada depois, na tela de proposta, com o
 * contato já escolhido. Criar o contato respeita o teto de contatos do plano.
 */
export async function convertLead(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const uid = req.user?.uid;
    if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "kanban", "canEdit"))) {
      return res.status(403).json({ message: "Sem permissão para editar leads." });
    }

    const found = await loadLeadOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Lead não encontrado." });

    const existingClientId = found.data.clientId as string | undefined;
    if (existingClientId) {
      const client = await db.collection("clients").doc(existingClientId).get();
      if (client.exists && client.data()?.tenantId === tenantId) {
        if (isLeadOpen(found.data.stage)) {
          await found.ref.update({ stage: "convertido", updatedAt: new Date().toISOString() });
        }
        return res.json({ clientId: existingClientId, created: false });
      }
    }

    if (!(await hasPagePermission(req.user, "clients", "canCreate"))) {
      return res.status(403).json({ message: "Sem permissão para criar contatos." });
    }

    const decision = await enforceTenantPlanLimit({
      tenantId,
      feature: "maxClients",
      loadCurrentUsage: () => getTenantClientsUsage(tenantId),
      uid,
      requestId: req.requestId,
      route: req.path,
      isSuperAdmin: req.user?.isSuperAdmin === true,
    });
    if (!decision.allowed) {
      return res.status(decision.statusCode || 402).json({
        message: decision.message || "Limite de contatos atingido para o plano atual.",
        code: decision.code || "PLAN_LIMIT_EXCEEDED",
      });
    }

    const name = String(found.data.name ?? "").trim();
    const email = (found.data.email as string | undefined) || undefined;
    const phone = (found.data.phone as string | undefined) || undefined;
    const now = Timestamp.now();
    const clientRef = db.collection("clients").doc();
    const clientData = compact({
      tenantId,
      name,
      types: ["cliente"],
      source: "lead",
      sourceId: req.params.id,
      searchTokens: buildClientSearchTokens(name, email, phone),
      email: email?.toLowerCase().trim(),
      phone,
      notes: (found.data.notes as string | undefined) || undefined,
      // Quem cuidava do lead passa a cuidar do cliente.
      responsibleMemberId: (found.data.ownerId as string | undefined) || undefined,
      responsibleMemberName: found.data.ownerId
        ? (found.data.ownerName as string | undefined) || undefined
        : undefined,
      createdAt: now,
      updatedAt: now,
    });

    await db.runTransaction(async (tx) => {
      const companyRef = db.collection("companies").doc(tenantId);
      const companySnap = await tx.get(companyRef);
      tx.set(clientRef, clientData);
      if (companySnap.exists) {
        tx.update(companyRef, { "usage.clients": FieldValue.increment(1), updatedAt: now });
      }
      tx.update(found.ref, {
        clientId: clientRef.id,
        stage: "convertido",
        updatedAt: new Date().toISOString(),
      });
    });

    return res.status(201).json({ clientId: clientRef.id, created: true });
  } catch (error) {
    console.error("convertLead Error:", error);
    return res.status(500).json({ message: "Erro ao converter o lead." });
  }
}
