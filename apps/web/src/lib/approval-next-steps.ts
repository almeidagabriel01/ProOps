/**
 * Os próximos passos de uma proposta recém-aprovada, mostrados numa janela
 * só ("Proposta aprovada"), montada uma vez no shell
 * (`ApprovalNextStepsHost`).
 *
 * Até 2026-09-29 eram até três janelas seguidas (emitir a nota, criar a obra,
 * ativar o contrato), cada uma travando a tela até ser respondida. Agora cada
 * passo é uma linha opcional da mesma janela, e "Fechar" dispensa todos.
 *
 * Os passos chegam de lugares diferentes e em momentos diferentes: a obra e o
 * contrato vêm na resposta da aprovação (`announceProjectOnApproval`), a nota
 * vem de uma consulta ao fiscal que corre em paralelo e termina depois. A
 * janela espera a consulta da nota (até `INVOICE_WAIT_MS`), para não abrir sem
 * ela e mudar de tamanho na cara da pessoa.
 *
 * Estado em módulo, e não em contexto: a aprovação acontece em três telas
 * (lista, quadro e formulário), e o formulário navega logo depois de salvar;
 * o host no shell sobrevive à troca de página.
 */

export interface InvoiceStep {
  documentos: Array<{ type: "nfe" | "nfse"; valorTotal: number }>;
}

export type ProjectStep = { kind: "suggested" } | { kind: "created"; projectId: string };

export interface ApprovalEntry {
  proposalId: string;
  proposalTitle: string;
  /** Desde quando a consulta da nota está em andamento (ms); `null` = decidida. */
  invoicePendingSince: number | null;
  invoice: InvoiceStep | null;
  project: ProjectStep | null;
  contract: { contractId: string } | null;
}

/** Quanto a janela espera a consulta da nota antes de abrir sem ela. */
export const INVOICE_WAIT_MS = 20_000;

type Listener = () => void;

let entries: ApprovalEntry[] = [];
const listeners = new Set<Listener>();

function emit() {
  entries = [...entries];
  listeners.forEach((listener) => listener());
}

function upsert(proposalId: string, patch: (entry: ApprovalEntry) => ApprovalEntry) {
  const index = entries.findIndex((e) => e.proposalId === proposalId);
  const current: ApprovalEntry =
    index >= 0
      ? entries[index]
      : { proposalId, proposalTitle: "", invoicePendingSince: null, invoice: null, project: null, contract: null };
  const next = patch(current);
  if (index >= 0) entries[index] = next;
  else entries.push(next);
  emit();
}

export function subscribeApprovalSteps(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getApprovalEntries(): ApprovalEntry[] {
  return entries;
}

/** A consulta da nota começou: a janela espera por ela. */
export function expectInvoiceStep(proposalId: string, now = Date.now()) {
  upsert(proposalId, (e) => ({ ...e, invoicePendingSince: now }));
}

/** A consulta da nota decidiu: `null` quando a nota não pode (ou não deve) sair. */
export function resolveInvoiceStep(proposalId: string, proposalTitle: string, invoice: InvoiceStep | null) {
  upsert(proposalId, (e) => ({
    ...e,
    proposalTitle: e.proposalTitle || proposalTitle,
    invoicePendingSince: null,
    invoice,
  }));
  // Nada a oferecer (sem nota, sem obra, sem contrato): o registro não fica.
  const entry = entries.find((e) => e.proposalId === proposalId);
  if (entry && !hasAnyStep(entry)) dismissApprovalSteps(proposalId);
}

/** O que a resposta da aprovação disse sobre a obra e o contrato. */
export function reportApprovalSteps(
  proposalId: string,
  proposalTitle: string,
  steps: { project: ProjectStep | null; contract: { contractId: string } | null },
) {
  if (!steps.project && !steps.contract && !entries.some((e) => e.proposalId === proposalId)) return;
  upsert(proposalId, (e) => ({
    ...e,
    proposalTitle: proposalTitle || e.proposalTitle,
    project: steps.project ?? e.project,
    contract: steps.contract ?? e.contract,
  }));
}

/** A aprovação falhou, ou a pessoa fechou a janela: some tudo desta proposta. */
export function dismissApprovalSteps(proposalId: string) {
  const before = entries.length;
  entries = entries.filter((e) => e.proposalId !== proposalId);
  if (entries.length !== before) emit();
}

export function hasAnyStep(entry: ApprovalEntry): boolean {
  return Boolean(entry.invoice || entry.project || entry.contract);
}

/** Pronta para mostrar: tem o que oferecer e não está mais esperando a nota. */
export function isEntryReady(entry: ApprovalEntry, now = Date.now()): boolean {
  const waiting = entry.invoicePendingSince !== null && now - entry.invoicePendingSince < INVOICE_WAIT_MS;
  return !waiting && hasAnyStep(entry);
}

/**
 * Só a obra criada sozinha (modo "sempre"), sem nada a decidir: vale um aviso
 * curto, não uma janela.
 */
export function isInformationalOnly(entry: ApprovalEntry): boolean {
  return !entry.invoice && !entry.contract && entry.project?.kind === "created";
}

/** Só para teste. */
export function resetApprovalSteps() {
  entries = [];
  listeners.clear();
}
