/**
 * Leitura do corpo das rotas de emissão que aceitam edição da NF-e: a nota que
 * nasce da proposta (revisada antes de sair) e a nota avulsa.
 *
 * Puro, sem Firestore: a fronteira da requisição testada à parte. Dado que a
 * SEFAZ recusaria (chave cortada, CST de IPI de entrada, natureza inventada)
 * para aqui com 400, antes de consumir número da série.
 */

import {
  DEFAULT_NATUREZA,
  isNaturezaOperacao,
  type NaturezaOperacao,
} from "./natureza-operacao";
import { parseIpi, parseNotasReferenciadas, parseTransporte } from "./nfe-extras";
import type { ManualNfeLine, NfeEdits, NfeLineEdit } from "./invoice-assembly.service";

/** Teto de linhas da nota avulsa: muito acima de qualquer remessa real. */
export const MANUAL_NFE_MAX_LINES = 100;

function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Situação do ICMS digitada na nota: CST (2 dígitos) ou CSOSN (3). Vazio ou
 * fora do formato volta `undefined`, e a operação decide.
 */
function parseSituacao(value: unknown): string | undefined {
  const digits = text(value, 3).replace(/\D/g, "");
  return digits.length === 2 || digits.length === 3 ? digits : undefined;
}

/** `undefined` = não mexer; `null` = tirar; objeto = este IPI. */
function parseIpiEdit(value: unknown): NfeLineEdit["ipi"] {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return parseIpi(value) ?? null;
}

/**
 * Natureza da operação do corpo. Ausente = a padrão (venda); presente e
 * desconhecida = erro, nunca a padrão: trocar a operação em silêncio poria
 * uma remessa na rua como venda.
 */
export function parseNatureza(value: unknown): NaturezaOperacao {
  const raw = text(value, 60);
  if (!raw) return DEFAULT_NATUREZA;
  if (!isNaturezaOperacao(raw)) throw new Error("NATUREZA_OPERACAO_INVALIDA");
  return raw;
}

export function parseNfeEdits(value: unknown): NfeEdits | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const edits: NfeEdits = {};

  if (typeof raw.observacoes === "string") edits.observacoes = text(raw.observacoes, 2000);
  if (raw.notasReferenciadas !== undefined) {
    edits.notasReferenciadas = parseNotasReferenciadas(raw.notasReferenciadas);
  }
  const transporte = parseTransporte(raw.transporte);
  if (transporte) edits.transporte = transporte;

  if (Array.isArray(raw.linhas)) {
    edits.linhas = raw.linhas.slice(0, 500).flatMap((item): NfeLineEdit[] => {
      if (!item || typeof item !== "object") return [];
      const line = item as Record<string, unknown>;
      const index = Number(line.index);
      const productId = text(line.productId, 128);
      if (!Number.isInteger(index) || index < 0 || !productId) return [];
      const edit: NfeLineEdit = { index, productId };
      const ipi = parseIpiEdit(line.ipi);
      if (ipi !== undefined) edit.ipi = ipi;
      const situacao = parseSituacao(line.situacaoTributaria);
      if (situacao) edit.situacaoTributaria = situacao;
      return [edit];
    });
  }

  return edits;
}

/** As linhas da nota avulsa. @throws `NOTA_AVULSA_ITENS_DEMAIS` acima do teto. */
export function parseManualLines(value: unknown): ManualNfeLine[] {
  const list = Array.isArray(value) ? value : [];
  if (list.length > MANUAL_NFE_MAX_LINES) throw new Error("NOTA_AVULSA_ITENS_DEMAIS");
  return list.flatMap((item): ManualNfeLine[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const line: ManualNfeLine = {
      descricao: text(raw.descricao, 120),
      quantidade: Number(raw.quantidade) || 0,
      valorUnitario: Number(raw.valorUnitario) || 0,
    };
    const productId = text(raw.productId, 128);
    if (productId) line.productId = productId;
    const ncm = text(raw.ncm, 10).replace(/\D/g, "");
    if (ncm) line.ncm = ncm;
    const cest = text(raw.cest, 9).replace(/\D/g, "");
    if (cest) line.cest = cest;
    const unidade = text(raw.unidade, 6);
    if (unidade) line.unidade = unidade;
    if (raw.origem !== undefined && raw.origem !== null && raw.origem !== "") {
      line.origem = Number(raw.origem);
    }
    const ipi = parseIpiEdit(raw.ipi);
    if (ipi !== undefined) line.ipi = ipi;
    const situacao = parseSituacao(raw.situacaoTributaria);
    if (situacao) line.situacaoTributaria = situacao;
    return [line];
  });
}

/** Códigos de entrada inválida: viram 400 com mensagem para a pessoa. */
export const NFE_REQUEST_ERRORS: Record<string, string> = {
  NATUREZA_OPERACAO_INVALIDA: "Escolha uma das operações da lista.",
  IPI_CST_INVALIDO: "O CST do IPI precisa ser um código de saída (50 a 55 ou 99).",
  IPI_ALIQUOTA_INVALIDA: "A alíquota do IPI precisa estar entre 0 e 100%.",
  TRANSPORTADORA_DOCUMENTO_INVALIDO: "O CPF ou CNPJ da transportadora está incompleto.",
  CHAVE_REFERENCIADA_INVALIDA: "A chave de acesso da nota referenciada tem 44 dígitos.",
  NOTA_AVULSA_ITENS_DEMAIS: "A nota aceita até 100 itens.",
  NOTA_AVULSA_SEM_CLIENTE: "Escolha o destinatário da nota.",
};
