import { Timestamp } from "firebase-admin/firestore";
import type { Transaction } from "firebase-admin/firestore";
import { db } from "../../init";
import {
  allocateNextNumber,
  buildProposalCode,
  normalizePraca,
  sanitizeNumberingConfig,
  type ProposalNumberingConfig,
} from "../controllers/proposal-numbering";

/**
 * Configuracao e contador da numeracao, um documento por empresa.
 *
 * Colecao propria em vez de um map em `tenants/{id}` por dois motivos:
 * o doc do tenant e lido por qualquer membro (e o Firestore nao tem regra por
 * campo), e ele esta no caminho de autenticacao, onde uma escrita quente a cada
 * proposta criada nao tem o que fazer. Aqui a regra e `if false`: o contador
 * nunca pode ser escrito pelo cliente.
 */
export const PROPOSAL_COUNTERS_COLLECTION = "proposal_counters";

export type AllocatedProposalNumber = {
  proposalNumber: number;
  proposalYear: number;
  proposalPraca: string | null;
  proposalCode: string;
};

function counterRef(tenantId: string) {
  return db.collection(PROPOSAL_COUNTERS_COLLECTION).doc(tenantId);
}

/** Le a configuracao fora de transacao (leitura da tela de configuracoes). */
export async function readNumberingConfig(
  tenantId: string,
): Promise<ProposalNumberingConfig> {
  const snap = await counterRef(tenantId).get();
  return sanitizeNumberingConfig(snap.data());
}

/**
 * Le o contador DENTRO da transacao de criacao da proposta.
 *
 * Fica separado da escrita porque o Firestore exige todas as leituras antes de
 * qualquer escrita; o chamador encaixa cada metade no bloco certo.
 */
export async function readNumberingStateInTransaction(
  t: Transaction,
  tenantId: string,
): Promise<ProposalNumberingConfig> {
  const snap = await t.get(counterRef(tenantId));
  return sanitizeNumberingConfig(snap.data());
}

/**
 * Decide o codigo desta proposta e grava o contador avancado.
 *
 * Devolve `null` quando a numeracao esta desligada, que e o estado de toda
 * empresa que nao pediu por ela: a proposta e gravada sem campo nenhum de
 * codigo, exatamente como antes.
 *
 * A praca so entra se estiver na lista da empresa. Uma sigla livre vinda do
 * formulario produziria um codigo que a propria empresa nao reconhece, e o
 * codigo existe justamente para ser consistente.
 */
export function allocateProposalNumberInTransaction(params: {
  t: Transaction;
  tenantId: string;
  config: ProposalNumberingConfig;
  praca?: unknown;
  now: Timestamp;
}): AllocatedProposalNumber | null {
  const { t, tenantId, config, now } = params;
  if (!config.enabled) return null;

  const pedida = normalizePraca(params.praca);
  const praca = pedida && config.pracas.includes(pedida)
    ? pedida
    : config.defaultPraca;

  const currentYear = now.toDate().getFullYear();
  const alocado = allocateNextNumber(config, currentYear);

  t.set(
    counterRef(tenantId),
    {
      ...config,
      nextNumber: alocado.nextState.nextNumber,
      year: alocado.nextState.year,
      tenantId,
      updatedAt: now,
    },
    { merge: true },
  );

  return {
    proposalNumber: alocado.number,
    proposalYear: alocado.year,
    proposalPraca: praca,
    proposalCode: buildProposalCode({
      number: alocado.number,
      year: alocado.year,
      praca,
      digits: config.digits,
    }),
  };
}

/**
 * Grava a configuracao vinda da tela.
 *
 * `nextNumber` e editavel de proposito: quem ja emitia propostas fora do ERP
 * precisa continuar a sequencia dele, nao recomecar do 1. E exatamente por ser
 * editavel que o que chega e mesclado sobre o que esta gravado, dentro de uma
 * transacao: um payload parcial (ou uma tela que so mande a lista de pracas)
 * cairia no default `nextNumber: 1` e REBOBINARIA a sequencia, fazendo a
 * proxima proposta nascer com um codigo que ja foi entregue a um cliente.
 */
export async function saveNumberingConfig(
  tenantId: string,
  input: unknown,
): Promise<ProposalNumberingConfig> {
  const patch = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;

  return db.runTransaction(async (t) => {
    const ref = counterRef(tenantId);
    const snap = await t.get(ref);
    const atual = sanitizeNumberingConfig(snap.data());
    const config = sanitizeNumberingConfig({ ...atual, ...patch });

    t.set(ref, { ...config, tenantId, updatedAt: Timestamp.now() }, { merge: true });
    return config;
  });
}
