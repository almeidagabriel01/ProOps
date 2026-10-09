/**
 * Nota de ORIGEM: a NF-e que a nova nota referencia (a compra devolvida, a
 * nota do aparelho que vai para o conserto, a nota que o cliente mandou com o
 * equipamento).
 *
 * Quem emite remessa e devolução copia os itens dessa nota, às vezes só parte
 * deles ("a nota tem 5, mando 1"). Este módulo lê o XML da NF-e e devolve os
 * itens já no formato da linha da nota avulsa, mais a chave para a referência.
 * A tela escolhe os itens e as quantidades.
 *
 * Puro, sem Firestore. A outra fonte, as notas recebidas que o ERP já guarda,
 * é mapeada para o mesmo formato no front a partir da lista que ele já tem.
 *
 * O XML vem do usuário, então é tratado como entrada hostil: tamanho limitado,
 * DOCTYPE recusado (é por ele que entram entidades externas e expansão), e
 * nenhum valor lido aqui é confiado sem o mesmo saneamento da linha digitada.
 */

import { XMLParser } from "fast-xml-parser";

/** Uma NF-e com 990 itens fica abaixo disso; o corpo da API aceita 1 MB. */
export const SOURCE_XML_MAX_LENGTH = 900_000;

export interface SourceDocumentItem {
  /** `nItem` na nota de origem. */
  numero: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cest?: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  origem?: number;
  /** ICMS destacado na origem: a devolução costuma espelhá-lo. */
  icms?: {
    situacao: string;
    baseCalculo?: number;
    reducaoBase?: number;
    aliquota?: number;
    valor?: number;
  };
  ipi?: { cst: string; baseCalculo?: number; aliquota?: number; valor?: number };
}

export interface SourceDocument {
  chave: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  naturezaOperacao?: string;
  emitente: { documento: string; nome: string };
  destinatario?: { documento: string; nome: string };
  valorTotal: number;
  /**
   * A nota em relação à empresa: `recebida` (somos o destinatário), `emitida`
   * (somos o emitente) ou `outra`. A tela avisa no último caso, que quase
   * sempre é o arquivo errado; não bloqueia, porque referenciar nota de
   * terceiro tem caso legítimo.
   */
  relacao: "recebida" | "emitida" | "outra";
  itens: SourceDocumentItem[];
}

type XmlNode = Record<string, unknown>;

function node(value: unknown): XmlNode | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as XmlNode) : undefined;
}

function list(value: unknown): XmlNode[] {
  if (Array.isArray(value)) return value.map(node).filter((item): item is XmlNode => Boolean(item));
  const single = node(value);
  return single ? [single] : [];
}

function text(value: unknown, max = 200): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number") return String(value);
  return "";
}

function digits(value: unknown): string {
  return text(value).replace(/\D/g, "");
}

function decimal(value: unknown): number | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Dígito verificador da chave (módulo 11, pesos 2 a 9 da direita para a
 * esquerda). Uma chave digitada com um número trocado passaria pelo tamanho e
 * só voltaria da SEFAZ como rejeição.
 */
export function isChaveAcessoValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i -= 1) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  // Tudo como texto: NCM, CFOP e CST têm zeros à esquerda que um número perderia.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: false,
});

/** O grupo de ICMS da linha (`ICMS00`, `ICMSSN101`...): é um só por item. */
function readIcms(imposto: XmlNode | undefined): { origem?: number; icms?: SourceDocumentItem["icms"] } {
  const grupo = node(imposto?.ICMS);
  const detalhe = grupo ? node(Object.values(grupo)[0]) : undefined;
  if (!detalhe) return {};
  const origemRaw = decimal(detalhe.orig);
  const origem = origemRaw !== undefined && Number.isInteger(origemRaw) ? origemRaw : undefined;
  const situacao = digits(detalhe.CSOSN) || digits(detalhe.CST);
  if (!situacao) return { origem };
  const icms: NonNullable<SourceDocumentItem["icms"]> = { situacao };
  const baseCalculo = decimal(detalhe.vBC);
  if (baseCalculo !== undefined) icms.baseCalculo = baseCalculo;
  const reducaoBase = decimal(detalhe.pRedBC);
  if (reducaoBase !== undefined) icms.reducaoBase = reducaoBase;
  const aliquota = decimal(detalhe.pICMS);
  if (aliquota !== undefined) icms.aliquota = aliquota;
  const valor = decimal(detalhe.vICMS);
  if (valor !== undefined) icms.valor = valor;
  return { origem, icms };
}

function readIpi(imposto: XmlNode | undefined): SourceDocumentItem["ipi"] {
  const grupo = node(imposto?.IPI);
  const tributado = node(grupo?.IPITrib);
  const naoTributado = node(grupo?.IPINT);
  const detalhe = tributado ?? naoTributado;
  const cst = digits(detalhe?.CST);
  if (!detalhe || !cst) return undefined;
  const ipi: NonNullable<SourceDocumentItem["ipi"]> = { cst };
  const baseCalculo = decimal(detalhe.vBC);
  if (baseCalculo !== undefined) ipi.baseCalculo = baseCalculo;
  const aliquota = decimal(detalhe.pIPI);
  if (aliquota !== undefined) ipi.aliquota = aliquota;
  const valor = decimal(detalhe.vIPI);
  if (valor !== undefined) ipi.valor = valor;
  return ipi;
}

function readItem(det: XmlNode, index: number): SourceDocumentItem {
  const prod = node(det.prod) ?? {};
  const imposto = node(det.imposto);
  const quantidade = decimal(prod.qCom) ?? 0;
  const valorTotal = decimal(prod.vProd) ?? 0;
  const { origem, icms } = readIcms(imposto);
  const ipi = readIpi(imposto);
  const cest = digits(prod.CEST);
  return {
    numero: Number(digits(det["@_nItem"])) || index + 1,
    codigo: text(prod.cProd, 60),
    descricao: text(prod.xProd, 120),
    ncm: digits(prod.NCM),
    ...(cest ? { cest } : {}),
    cfop: digits(prod.CFOP),
    unidade: text(prod.uCom, 6).toUpperCase(),
    quantidade,
    valorUnitario: decimal(prod.vUnCom) ?? (quantidade > 0 ? valorTotal / quantidade : valorTotal),
    valorTotal,
    ...(origem !== undefined ? { origem } : {}),
    ...(icms ? { icms } : {}),
    ...(ipi ? { ipi } : {}),
  };
}

function party(value: unknown): { documento: string; nome: string } | undefined {
  const raw = node(value);
  if (!raw) return undefined;
  return { documento: digits(raw.CNPJ) || digits(raw.CPF), nome: text(raw.xNome, 120) };
}

/**
 * Lê o XML de uma NF-e (o `nfeProc` que se baixa da SEFAZ ou do emissor, ou só
 * o `NFe`) e devolve a nota de origem.
 *
 * @param cnpjEmpresa CNPJ do emitente que vai referenciar a nota, para dizer
 *   se ela foi recebida ou emitida por ele.
 * @throws `XML_GRANDE_DEMAIS`, `XML_COM_DOCTYPE`, `XML_INVALIDO`,
 *   `XML_NAO_E_NFE`, `XML_CHAVE_INVALIDA`, `XML_SEM_ITENS`.
 */
export function parseSourceDocumentXml(xml: string, cnpjEmpresa: string): SourceDocument {
  if (xml.length > SOURCE_XML_MAX_LENGTH) throw new Error("XML_GRANDE_DEMAIS");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML_COM_DOCTYPE");

  let tree: XmlNode;
  try {
    tree = parser.parse(xml) as XmlNode;
  } catch {
    throw new Error("XML_INVALIDO");
  }

  const proc = node(tree.nfeProc);
  const nfe = node(proc?.NFe) ?? node(tree.NFe);
  const inf = node(nfe?.infNFe);
  if (!inf) throw new Error("XML_NAO_E_NFE");

  const chave =
    digits(node(node(proc?.protNFe)?.infProt)?.chNFe) || digits(inf["@_Id"]);
  if (!isChaveAcessoValida(chave)) throw new Error("XML_CHAVE_INVALIDA");

  const itens = list(inf.det).map(readItem);
  if (itens.length === 0) throw new Error("XML_SEM_ITENS");

  const ide = node(inf.ide);
  const emitente = party(inf.emit) ?? { documento: "", nome: "" };
  const destinatario = party(inf.dest);
  const empresa = cnpjEmpresa.replace(/\D/g, "");
  const relacao: SourceDocument["relacao"] =
    empresa && destinatario?.documento === empresa
      ? "recebida"
      : empresa && emitente.documento === empresa
        ? "emitida"
        : "outra";

  const total = node(node(inf.total)?.ICMSTot);
  return {
    chave,
    ...(text(ide?.nNF) ? { numero: text(ide?.nNF, 9) } : {}),
    ...(text(ide?.serie) ? { serie: text(ide?.serie, 3) } : {}),
    ...(text(ide?.dhEmi) || text(ide?.dEmi) ? { dataEmissao: text(ide?.dhEmi) || text(ide?.dEmi) } : {}),
    ...(text(ide?.natOp) ? { naturezaOperacao: text(ide?.natOp, 60) } : {}),
    emitente,
    ...(destinatario ? { destinatario } : {}),
    valorTotal: decimal(total?.vNF) ?? itens.reduce((sum, item) => sum + item.valorTotal, 0),
    relacao,
    itens,
  };
}

/** Códigos de XML recusado: viram 400 com mensagem para a pessoa. */
export const SOURCE_DOCUMENT_ERRORS: Record<string, string> = {
  XML_GRANDE_DEMAIS: "O arquivo é grande demais para uma NF-e.",
  XML_COM_DOCTYPE: "O arquivo não é um XML de NF-e válido.",
  XML_INVALIDO: "Não foi possível ler o arquivo. Confira se é o XML da nota.",
  XML_NAO_E_NFE: "O arquivo não é o XML de uma NF-e. NFS-e e CT-e não servem de nota de origem.",
  XML_CHAVE_INVALIDA: "A chave de acesso do XML não confere. Confira se o arquivo não foi alterado.",
  XML_SEM_ITENS: "O XML não traz nenhum item.",
};
