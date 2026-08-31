/**
 * Focus NFe → domínio, para notas de entrada.
 *
 * Mesma disciplina do `focus-response.ts`: os nomes de campo do provedor ficam
 * confinados aqui. Construído contra a documentação sem conta ativa, então o
 * primeiro contato real pode exigir ajuste — e por isso o mapeamento está num
 * arquivo só.
 *
 * O endpoint `/json` do Focus já entrega o XML convertido, o que nos poupa de
 * escrever e manter um parser de NF-e 4.00 — um dos pontos mais chatos de
 * qualquer integração fiscal.
 */

import type {
  ReceivedInvoiceDocument,
  ReceivedInvoiceItem,
  ReceivedInvoiceStatus,
} from "./received-invoice.types";

/** Resumo que a Receita entrega antes da manifestação. */
export interface FocusReceivedSummary {
  chave_nfe?: string;
  versao?: number | string;
  cnpj_emitente?: string;
  nome_emitente?: string;
  uf_emitente?: string;
  numero?: string | number;
  serie?: string | number;
  data_emissao?: string;
  valor_total?: string | number;
  /** `cancelada`, `denegada` etc. quando o emitente alterou a nota. */
  situacao?: string;
  /** Presentes só depois da confirmação. */
  itens?: Array<Record<string, unknown>>;
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function num(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Deriva a situação da nota.
 *
 * `cancelada` vence tudo: uma nota cancelada pelo emitente não pode voltar a
 * parecer válida só porque os itens vieram junto.
 */
export function mapReceivedStatus(
  situacao: string | undefined,
  hasItems: boolean,
): ReceivedInvoiceStatus {
  if (/cancel|denegad/i.test(String(situacao ?? ""))) {
    return "cancelada";
  }
  return hasItems ? "completa" : "resumo";
}

function mapItem(raw: Record<string, unknown>, index: number): ReceivedInvoiceItem {
  const quantidade = num(raw.quantidade_comercial ?? raw.quantidade);
  const valorTotal = num(raw.valor_bruto ?? raw.valor_total);

  return {
    numero: Number(raw.numero_item) || index + 1,
    codigo: text(raw.codigo_produto) || undefined,
    descricao: text(raw.descricao) || "Item sem descrição",
    // O campo que justifica o módulo: alimenta o catálogo fiscal da emissão.
    ncm: digits(raw.codigo_ncm) || undefined,
    cfop: digits(raw.cfop) || undefined,
    unidade: text(raw.unidade_comercial) || undefined,
    quantidade,
    valorUnitario:
      num(raw.valor_unitario_comercial) ||
      (quantidade > 0 ? valorTotal / quantidade : valorTotal),
    valorTotal,
  };
}

/**
 * Normaliza um resumo ou nota completa vinda do provedor.
 *
 * @throws quando não há chave de acesso — ela é a identidade do documento e a
 * chave natural do nosso registro; sem ela não há o que gravar nem como
 * deduplicar.
 */
export function mapReceivedInvoice(
  raw: FocusReceivedSummary,
  tenantId: string,
): Omit<ReceivedInvoiceDocument, "id" | "createdAt" | "updatedAt"> {
  const chaveAcesso = digits(raw.chave_nfe);
  if (chaveAcesso.length !== 44) {
    throw new Error("NOTA_RECEBIDA_SEM_CHAVE");
  }

  const itensRaw = Array.isArray(raw.itens) ? raw.itens : [];
  const itens = itensRaw.map(mapItem);

  const mapped: Omit<ReceivedInvoiceDocument, "id" | "createdAt" | "updatedAt"> = {
    tenantId,
    chaveAcesso,
    versao: num(raw.versao),
    status: mapReceivedStatus(raw.situacao, itens.length > 0),
    emitenteCnpj: digits(raw.cnpj_emitente),
    valorTotal: num(raw.valor_total),
  };

  const nome = text(raw.nome_emitente);
  if (nome) mapped.emitenteNome = nome;

  const uf = text(raw.uf_emitente).toUpperCase();
  if (uf) mapped.emitenteUf = uf;

  const numero = text(raw.numero);
  if (numero) mapped.numero = numero;

  const serie = text(raw.serie);
  if (serie) mapped.serie = serie;

  const dataEmissao = text(raw.data_emissao);
  if (dataEmissao) mapped.dataEmissao = dataEmissao;

  // Ausência de itens é o estado normal antes da manifestação — gravar array
  // vazio faria a UI mostrar "nota sem itens" em vez de "aguardando confirmação".
  if (itens.length > 0) mapped.itens = itens;

  return mapped;
}

/**
 * Extrai a maior versão de um lote.
 *
 * O provedor também devolve isso no cabeçalho `X-Max-Version`, mas derivar do
 * corpo evita depender de um header que pode faltar numa resposta parcial.
 */
export function maxVersionOf(items: FocusReceivedSummary[]): number {
  return items.reduce((max, item) => Math.max(max, num(item.versao)), 0);
}
