/**
 * Notas emitidas **contra** o CNPJ do tenant — as notas de entrada.
 *
 * Complementa o módulo de emissão e é independente dele: um funciona sem o
 * outro. A diferença conceitual que molda todo o desenho: aqui **não somos o
 * emitente**. Não controlamos numeração, não assinamos nada, não cancelamos. O
 * documento é do fornecedor; nós recebemos, arquivamos e nos manifestamos.
 */

/** Situação da nota perante a Receita, do ponto de vista do destinatário. */
export type ReceivedInvoiceStatus =
  /** Só o resumo chegou — o XML completo depende da manifestação. */
  | "resumo"
  /** XML completo disponível. */
  | "completa"
  /** O emitente cancelou depois de emitir. */
  | "cancelada";

/**
 * Manifestação do destinatário (Ajuste SINIEF 07/2005).
 *
 * É **ato formal perante a Receita**, não um clique de conveniência:
 * desconhecer uma operação legítima, ou confirmar uma indevida, tem
 * consequência fiscal. Por isso nunca é automática.
 */
export type ManifestationType =
  /** Ciência: sei que existe, ainda não sei se procede. Não libera o XML completo. */
  | "ciencia"
  /** Confirmação: a operação aconteceu. Libera o XML completo. */
  | "confirmacao"
  /** Desconhecimento: não reconheço esta nota. */
  | "desconhecimento"
  /** Não realizada: reconheço, mas a operação não se concretizou. Exige justificativa. */
  | "nao_realizada";

/** Justificativa mínima que a SEFAZ aceita em "operação não realizada". */
export const MANIFESTATION_JUSTIFICATION_MIN_LENGTH = 15;
export const MANIFESTATION_JUSTIFICATION_MAX_LENGTH = 255;

/** Manifestações que liberam o XML completo da nota. */
const UNLOCKS_FULL_XML: ManifestationType[] = ["confirmacao"];

export function unlocksFullXml(manifestation: ManifestationType): boolean {
  return UNLOCKS_FULL_XML.includes(manifestation);
}

/** Só "não realizada" exige justificativa. */
export function requiresJustification(manifestation: ManifestationType): boolean {
  return manifestation === "nao_realizada";
}

export interface ReceivedInvoiceItem {
  numero: number;
  codigo?: string;
  descricao: string;
  /** O motivo pelo qual este módulo vale a pena: alimenta o catálogo fiscal. */
  ncm?: string;
  cfop?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface ReceivedInvoiceDocument {
  id: string;
  tenantId: string;
  /** Chave de acesso de 44 dígitos — identidade da nota, e nossa chave natural. */
  chaveAcesso: string;

  /**
   * Versão do documento na base da Receita, única por CNPJ e incrementada a
   * cada alteração (cancelamento, carta de correção).
   *
   * É o cursor da sincronização: guardando a maior versão vista, buscamos só o
   * que ainda não conhecemos, em vez de varrer tudo a cada consulta. Também é o
   * que detecta um cancelamento posterior sem reconsultar nota por nota.
   */
  versao: number;

  status: ReceivedInvoiceStatus;

  emitenteCnpj: string;
  emitenteNome?: string;
  emitenteUf?: string;

  numero?: string;
  serie?: string;
  dataEmissao?: string;
  valorTotal: number;

  /** Presente só depois da confirmação — antes disso a Receita entrega só o resumo. */
  itens?: ReceivedInvoiceItem[];

  manifestacao?: ManifestationType;
  manifestadaEm?: string;
  manifestacaoJustificativa?: string;

  /** Espelhados no nosso Storage para a guarda legal de 5 anos. */
  storageXmlPath?: string;
  storagePdfPath?: string;

  /** Lançamento criado a partir desta nota, quando houver (Fase 3). */
  transactionId?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Decide se um documento recebido deve substituir o armazenado.
 *
 * A Receita reenvia a mesma nota com versão maior quando ela muda. Aceitar uma
 * versão menor sobrescreveria um cancelamento com o estado anterior — e a nota
 * voltaria a parecer válida.
 */
export function shouldApplyReceivedVersion(
  storedVersion: number | undefined,
  incomingVersion: number,
): boolean {
  if (typeof storedVersion !== "number") return true;
  return incomingVersion > storedVersion;
}
