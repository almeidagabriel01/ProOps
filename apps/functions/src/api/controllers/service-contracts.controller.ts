import { Request, Response } from "express";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { hasPagePermission } from "../../lib/auth-helpers";
import { tenantHasCapability } from "../../lib/tenant-capabilities";
import {
  ActivateContractSchema,
  CreateContractSchema,
  MAX_START_DAYS_AGO,
  SERVICE_CONTRACTS_COLLECTION,
  UpdateContractSchema,
  addDays,
  addMonthsOnDay,
  canContractTransition,
  computeMonthlyAmount,
  firstBillingDate,
  resumeBillingDate,
  todayInBrazil,
  type ContractStatus,
  type PmocInput,
  type ServiceContract,
  type VisitPlan,
} from "../services/field-service/contract-model";
import { TECHNICAL_RESPONSIBLES_COLLECTION } from "../services/field-service/technical-responsible-model";
import {
  allocateContractNumber,
  billContract,
  openContractVisit,
  readContract,
} from "../services/field-service/contract.service";
import { loadClientSnapshot, loadEquipmentLabels, loadOfTenant, loadTechnician } from "../services/field-service/field-service.service";
import { notifyTechnician, syncOrderAgenda } from "./field-service.controller";
import { SERVICE_ORDERS_COLLECTION } from "../services/field-service/field-service-model";

/**
 * Contratos de manutenção. Capacidade `fieldService` (montada por prefixo em
 * `field-service.routes.ts`), pageId `contracts`. A lista e o detalhe são
 * lidos direto no Firestore pelo front; aqui ficam as escritas. A cobrança do
 * mês é da rotina diária (`contract-billing-run.ts`); ativar e retomar só
 * adiantam a primeira execução para o contrato em questão.
 */

// Ação básica ou fina do catálogo de permissões (`lifecycle`, `editBilling`).
type Action = "canView" | "canCreate" | "canEdit" | "canDelete" | "lifecycle" | "editBilling";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message || "Dados inválidos.";
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

async function requireAccess(req: Request, action: Action): Promise<{ tenantId: string; uid: string }> {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new HttpError(403, "Tenant não identificado.");
  if (!(await hasPagePermission(req.user, "contracts", action))) {
    throw new HttpError(403, "Sem permissão para esta ação em Contratos.");
  }
  return { tenantId, uid };
}

async function loadContract(req: Request, tenantId: string) {
  const found = await loadOfTenant(SERVICE_CONTRACTS_COLLECTION, req.params.id, tenantId);
  if (!found) throw new HttpError(404, "Contrato não encontrado.");
  return { ref: found.ref, contract: readContract(found.ref.id, found.data) };
}

async function assertWallet(walletId: string, tenantId: string) {
  if (!(await loadOfTenant("wallets", walletId, tenantId))) {
    throw new HttpError(400, "Escolha uma carteira da empresa.");
  }
}

async function assertTechnician(technicianId: string | null | undefined, tenantId: string) {
  if (technicianId && !(await loadTechnician(technicianId, tenantId))) {
    throw new HttpError(400, "O técnico precisa ser da sua equipe.");
  }
}

async function assertResponsible(responsibleId: string | null | undefined, tenantId: string) {
  if (responsibleId && !(await loadOfTenant(TECHNICAL_RESPONSIBLES_COLLECTION, responsibleId, tenantId))) {
    throw new HttpError(400, "Escolha um responsável técnico da empresa.");
  }
}

/**
 * Ativar ou retomar põe o contrato para cobrar: a rotina lança uma
 * mensalidade por mês e, com `issueNfse`, emite a NFS-e de cada uma. Isso é
 * criar lançamento (e nota), então exige as permissões do financeiro e das
 * notas, e não só "Editar" em Contratos. Até 2026-10 quem só editava
 * contratos ligava a cobrança e a emissão sem ter nenhuma das duas.
 * Suspender e encerrar só param de cobrar, e seguem com a permissão de
 * Contratos.
 */
async function assertBillingPermission(req: Request, issueNfse: boolean) {
  if (!(await hasPagePermission(req.user, "transactions", "canCreate"))) {
    throw new HttpError(
      403,
      "Ligar a cobrança do contrato cria lançamentos: é preciso poder criar em Lançamentos.",
    );
  }
  if (issueNfse && !(await hasPagePermission(req.user, "invoices", "canCreate"))) {
    throw new HttpError(
      403,
      "Este contrato emite NFS-e: é preciso poder emitir em Notas Fiscais.",
    );
  }
}

/**
 * O que a edição muda na cobrança de um contrato que já cobra. O formulário
 * manda todos os campos em toda edição, então vale o valor, não a presença:
 * quem só ajusta o plano de visitas não mexe no que é lançado.
 */
export function billingChanges(
  current: Pick<ServiceContract, "lines" | "billingDay" | "wallet" | "issueNfse">,
  input: { lines?: unknown; billingDay?: number; wallet?: string; issueNfse?: boolean },
): { changed: boolean; issueNfse: boolean } {
  const issueNfse = input.issueNfse ?? current.issueNfse === true;
  const linesKey = (lines: unknown) =>
    JSON.stringify(
      (Array.isArray(lines) ? lines : []).map((line: Record<string, unknown>) => [
        line.id,
        line.kind,
        line.refId ?? null,
        line.name,
        Number(line.quantity),
        Number(line.unitPrice),
      ]),
    );
  const changed =
    (input.lines !== undefined && linesKey(input.lines) !== linesKey(current.lines)) ||
    (input.billingDay !== undefined && input.billingDay !== current.billingDay) ||
    (input.wallet !== undefined && input.wallet !== current.wallet) ||
    (input.issueNfse !== undefined && input.issueNfse !== (current.issueNfse === true));
  return { changed, issueNfse };
}

/** A mensalidade vira lançamento: sem o financeiro no plano, não há onde cobrar. */
async function assertFinancial(tenantId: string) {
  if (!(await tenantHasCapability(tenantId, "financial"))) {
    throw new HttpError(402, "A cobrança do contrato vai para o financeiro, que o seu plano não inclui.");
  }
}

function assertTransition(from: ContractStatus, to: ContractStatus) {
  if (!canContractTransition(from, to)) {
    throw new HttpError(409, "Este contrato não pode passar para essa situação.");
  }
}

/**
 * Adianta a rotina diária para um contrato recém-ativado ou retomado: a
 * mensalidade que já está na janela aparece na hora, e não amanhã cedo. Falhar
 * aqui não desfaz a ativação: a rotina tenta de novo.
 */
async function runNow(contractId: string, tenantId: string, uid: string) {
  const today = todayInBrazil();
  try {
    await billContract(contractId, today, false);
    const orderId = await openContractVisit(contractId, today, false);
    if (orderId) {
      await syncOrderAgenda(orderId, tenantId, uid);
      const created = (await db.collection(SERVICE_ORDERS_COLLECTION).doc(orderId).get()).data();
      if (created) await notifyTechnician({ tenantId, orderId, uid, before: null, after: created });
    }
  } catch (error) {
    logger.warn("service_contract_run_now_failed", {
      contractId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** O PMOC como é gravado; a âncora das frequências é da primeira visita. */
function pmocDoc(input: PmocInput, anchorDate: string | null) {
  return { ...input, anchorDate };
}

/** POST /v1/service-contracts */
export async function createServiceContract(req: Request, res: Response) {
  const parsed = CreateContractSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "canCreate");
    // O contrato nasce com a mensalidade: quem não vê os valores não a monta.
    if (!(await hasPagePermission(req.user, "contracts", "viewValues"))) {
      throw new HttpError(403, "Criar contrato pede a permissão de ver os valores da mensalidade.");
    }
    const input = parsed.data;
    const client = await loadClientSnapshot(input.clientId, tenantId);
    if (!client) return res.status(404).json({ message: "Contato não encontrado." });
    const equipment = await loadEquipmentLabels(input.equipmentIds ?? [], tenantId, client.id);
    if (!equipment) return res.status(400).json({ message: "Escolha equipamentos deste cliente." });
    await assertWallet(input.wallet, tenantId);
    await assertTechnician(input.visitPlan?.technicianId, tenantId);
    if (input.type === "pmoc" && !input.pmoc) throw new HttpError(400, "Preencha os dados do PMOC.");
    await assertResponsible(input.pmoc?.responsibleId, tenantId);

    const now = new Date().toISOString();
    const ref = db.collection(SERVICE_CONTRACTS_COLLECTION).doc();
    const visitPlan: VisitPlan = {
      enabled: input.visitPlan?.enabled ?? false,
      intervalMonths: input.visitPlan?.intervalMonths ?? 3,
      technicianId: input.visitPlan?.technicianId ?? null,
      checklist: input.visitPlan?.checklist ?? [],
      nextVisitDate: null,
    };
    const code = await db.runTransaction(async (t) => {
      const allocated = await allocateContractNumber(t, tenantId);
      t.set(ref, {
        tenantId,
        number: allocated.number,
        code: allocated.code,
        clientId: client.id,
        clientName: client.name,
        title: input.title,
        type: input.type,
        status: "draft",
        lines: input.lines,
        monthlyAmount: computeMonthlyAmount(input.lines),
        billingDay: input.billingDay,
        wallet: input.wallet,
        issueNfse: input.issueNfse,
        equipmentIds: equipment.map((e) => e.id),
        visitPlan,
        notes: input.notes ?? null,
        startDate: null,
        endDate: input.endDate ?? null,
        nextBillingDate: null,
        lastBilledPeriod: null,
        suspendedReason: null,
        proposalId: null,
        pmoc: input.type === "pmoc" && input.pmoc ? pmocDoc(input.pmoc, null) : null,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
      });
      return allocated.code;
    });
    return res.status(201).json({ id: ref.id, code });
  } catch (error) {
    return fail(res, error, "Erro ao criar o contrato.", "service_contract_create_failed");
  }
}

/**
 * PUT /v1/service-contracts/:id
 *
 * Valor e itens valem para as próximas mensalidades: a que já foi lançada fica
 * como está (ajuste o lançamento no financeiro, se precisar). Mudar o dia de
 * cobrança de um contrato ativo recalcula a próxima sem cobrar de novo um mês
 * que já foi cobrado.
 */
export async function updateServiceContract(req: Request, res: Response) {
  const parsed = UpdateContractSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId } = await requireAccess(req, "canEdit");
    const { ref, contract } = await loadContract(req, tenantId);
    if (contract.status === "ended") throw new HttpError(409, "Este contrato está encerrado.");
    const input = parsed.data;
    // Quem não vê os valores recebe a tela sem preço: as linhas que ele
    // reenviasse viriam sem o valor de verdade. Ficam as gravadas.
    if (input.lines !== undefined && !(await hasPagePermission(req.user, "contracts", "viewValues"))) {
      delete input.lines;
    }
    // Num contrato que já cobra, mudar valor, dia, carteira ou NFS-e muda o que
    // é lançado daqui para a frente. No rascunho, a ativação confere.
    if (contract.status !== "draft") {
      const billing = billingChanges(contract, input);
      if (billing.changed) {
        // "Editar a cobrança" (ausente, vale o Editar) e o financeiro.
        if (!(await hasPagePermission(req.user, "contracts", "editBilling"))) {
          throw new HttpError(403, "Sem permissão para mudar a cobrança do contrato.");
        }
        await assertBillingPermission(req, billing.issueNfse);
      }
    }

    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of ["title", "type", "lines", "billingDay", "wallet", "issueNfse", "notes", "endDate"] as const) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.lines) update.monthlyAmount = computeMonthlyAmount(input.lines);
    if (input.wallet) await assertWallet(input.wallet, tenantId);

    const type = input.type ?? contract.type;
    if (type !== "pmoc") {
      if (contract.pmoc) update.pmoc = null;
    } else if (input.pmoc) {
      await assertResponsible(input.pmoc.responsibleId, tenantId);
      update.pmoc = pmocDoc(input.pmoc, contract.pmoc?.anchorDate ?? null);
    } else if (!contract.pmoc) {
      throw new HttpError(400, "Preencha os dados do PMOC.");
    }

    let clientId = contract.clientId;
    if (input.clientId && input.clientId !== contract.clientId) {
      if (contract.status !== "draft") throw new HttpError(409, "O cliente só muda enquanto o contrato é rascunho.");
      const client = await loadClientSnapshot(input.clientId, tenantId);
      if (!client) return res.status(404).json({ message: "Contato não encontrado." });
      clientId = client.id;
      update.clientId = client.id;
      update.clientName = client.name;
    }
    if (input.equipmentIds || update.clientId) {
      const ids = input.equipmentIds ?? (update.clientId ? [] : contract.equipmentIds);
      const equipment = await loadEquipmentLabels(ids, tenantId, clientId);
      if (!equipment) return res.status(400).json({ message: "Escolha equipamentos deste cliente." });
      update.equipmentIds = equipment.map((e) => e.id);
    }
    if (input.visitPlan) {
      await assertTechnician(input.visitPlan.technicianId, tenantId);
      const current = contract.visitPlan;
      const intervalChanged = input.visitPlan.intervalMonths !== current.intervalMonths;
      const turnedOn = input.visitPlan.enabled && !current.enabled;
      let nextVisitDate = current.nextVisitDate;
      if (contract.status !== "draft" && input.visitPlan.enabled && (turnedOn || intervalChanged || !nextVisitDate)) {
        const today = todayInBrazil();
        nextVisitDate = addMonthsOnDay(today, input.visitPlan.intervalMonths, Math.min(Number(today.slice(8, 10)), 28));
      }
      update.visitPlan = { ...input.visitPlan, nextVisitDate: input.visitPlan.enabled ? nextVisitDate : null };
    }
    if (input.billingDay !== undefined && input.billingDay !== contract.billingDay && contract.status === "active") {
      update.nextBillingDate = resumeBillingDate(todayInBrazil(), input.billingDay, contract.lastBilledPeriod);
    }
    await ref.update(update);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao atualizar o contrato.", "service_contract_update_failed");
  }
}

/**
 * POST /v1/service-contracts/:id/activate
 *
 * A empresa escolhe o início; a primeira mensalidade é o primeiro dia de
 * cobrança a partir dele. O início pode estar no passado por até um mês, para
 * registrar um contrato que já estava valendo, sem despejar cobranças antigas.
 */
export async function activateServiceContract(req: Request, res: Response) {
  const parsed = ActivateContractSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "lifecycle");
    await assertFinancial(tenantId);
    const { ref, contract } = await loadContract(req, tenantId);
    assertTransition(contract.status, "active");
    await assertBillingPermission(req, contract.issueNfse === true);
    if (contract.lines.length === 0 || contract.monthlyAmount <= 0) {
      throw new HttpError(400, "Defina o valor da mensalidade antes de ativar.");
    }
    if (!contract.wallet) throw new HttpError(400, "Escolha a carteira que recebe a mensalidade.");
    if (contract.type === "pmoc") {
      if (!contract.pmoc?.responsibleId) throw new HttpError(400, "Escolha o responsável técnico do PMOC.");
      await assertResponsible(contract.pmoc.responsibleId, tenantId);
      if (!contract.visitPlan.enabled) throw new HttpError(400, "O PMOC precisa do plano de visitas ligado.");
    }

    const today = todayInBrazil();
    const { startDate, firstVisitDate } = parsed.data;
    if (startDate < addDays(today, -MAX_START_DAYS_AGO)) {
      throw new HttpError(400, `O início pode ser de até ${MAX_START_DAYS_AGO} dias atrás.`);
    }
    if (contract.endDate && contract.endDate < startDate) {
      throw new HttpError(400, "O fim do contrato é antes do início.");
    }
    const plan = contract.visitPlan;
    const nextVisitDate = plan.enabled
      ? (firstVisitDate ?? addMonthsOnDay(startDate, plan.intervalMonths, Math.min(Number(startDate.slice(8, 10)), 28)))
      : null;

    await ref.update({
      status: "active",
      startDate,
      nextBillingDate: firstBillingDate(startDate, contract.billingDay),
      lastBilledPeriod: null,
      "visitPlan.nextVisitDate": nextVisitDate,
      suspendedReason: null,
      activatedAt: new Date().toISOString(),
      activatedBy: uid,
      updatedAt: new Date().toISOString(),
    });
    await runNow(contract.id, tenantId, uid);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao ativar o contrato.", "service_contract_activate_failed");
  }
}

/** POST /v1/service-contracts/:id/suspend. A mensalidade para de ser lançada. */
export async function suspendServiceContract(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireAccess(req, "lifecycle");
    const { ref, contract } = await loadContract(req, tenantId);
    assertTransition(contract.status, "suspended");
    await ref.update({
      status: "suspended",
      suspendedReason: "manual",
      suspendedAt: new Date().toISOString(),
      suspendedBy: uid,
      updatedAt: new Date().toISOString(),
    });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao suspender o contrato.", "service_contract_suspend_failed");
  }
}

/**
 * POST /v1/service-contracts/:id/resume
 *
 * Volta a cobrar a partir de hoje: o período em que ficou parado não é
 * cobrado, e um mês já cobrado não é cobrado de novo.
 */
export async function resumeServiceContract(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireAccess(req, "lifecycle");
    await assertFinancial(tenantId);
    if (!(await tenantHasCapability(tenantId, "fieldService"))) {
      throw new HttpError(402, "O seu plano não inclui contratos de manutenção.");
    }
    const { ref, contract } = await loadContract(req, tenantId);
    assertTransition(contract.status, "active");
    await assertBillingPermission(req, contract.issueNfse === true);
    const today = todayInBrazil();
    const plan = contract.visitPlan;
    const nextVisitDate =
      plan.enabled && (!plan.nextVisitDate || plan.nextVisitDate < today)
        ? addMonthsOnDay(today, plan.intervalMonths, Math.min(Number(today.slice(8, 10)), 28))
        : plan.nextVisitDate;
    await ref.update({
      status: "active",
      nextBillingDate: resumeBillingDate(today, contract.billingDay, contract.lastBilledPeriod),
      "visitPlan.nextVisitDate": plan.enabled ? nextVisitDate : null,
      suspendedReason: null,
      resumedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await runNow(contract.id, tenantId, uid);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao retomar o contrato.", "service_contract_resume_failed");
  }
}

/** POST /v1/service-contracts/:id/end. Mensalidades já lançadas ficam no financeiro. */
export async function endServiceContract(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireAccess(req, "lifecycle");
    const { ref, contract } = await loadContract(req, tenantId);
    assertTransition(contract.status, "ended");
    await ref.update({
      status: "ended",
      endedAt: new Date().toISOString(),
      endedBy: uid,
      endedReason: "manual",
      updatedAt: new Date().toISOString(),
    });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao encerrar o contrato.", "service_contract_end_failed");
  }
}

/** DELETE /v1/service-contracts/:id. Só rascunho: contrato que já cobrou se encerra. */
export async function deleteServiceContract(req: Request, res: Response) {
  try {
    const { tenantId } = await requireAccess(req, "canDelete");
    const { ref, contract } = await loadContract(req, tenantId);
    if (contract.status !== "draft") {
      throw new HttpError(409, "Só o rascunho pode ser excluído. Encerre o contrato para parar de cobrar.");
    }
    await ref.delete();
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir o contrato.", "service_contract_delete_failed");
  }
}

export type { ServiceContract };
