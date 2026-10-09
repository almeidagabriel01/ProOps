/**
 * Provider-agnostic domain types for fiscal document issuing.
 *
 * Nothing here mentions a specific provider. The Focus NFe shapes live in
 * `focus-payload.ts` (outbound) and `focus-response.ts` (inbound); swapping
 * providers means writing a new pair of those, not touching this file.
 */

/** Fiscal document kinds the ERP issues. NF-e is state (ICMS), NFS-e is municipal (ISS). */
export type FiscalDocumentType = "nfe" | "nfse";

/**
 * Qual padrão de NFS-e o emitente usa.
 *
 * **Não** é um terceiro `FiscalDocumentType`. Quase toda ramificação por tipo no
 * módulo pergunta "é nota de serviço?", e as duas respondem sim — um terceiro
 * valor no enum viraria bug silencioso em cada lugar que esquecesse de incluí-lo.
 * A variante fica aqui e só o adaptador do provedor a enxerga.
 *
 * `nacional` é o padrão: a NFS-e Nacional passa a ser obrigatória para ME/EPP do
 * Simples em 01/11/2026 (Res. CGSN 191/2026), e municípios que ainda mantêm
 * sistema próprio são a exceção decrescente.
 */
export type FiscalNfsePadrao = "nacional" | "municipal";

export type FiscalEnvironment = "homologacao" | "producao";

/**
 * Lifecycle of an invoice in our own storage.
 *
 * `draft` never left the ERP. Everything from `processing` on mirrors a state
 * the provider reported, so a status regression (a late webhook arriving after
 * a newer one) is detectable — see `isTerminalInvoiceStatus`.
 */
export type FiscalInvoiceStatus =
  | "draft"
  | "processing"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "error";

/** CRT — Código de Regime Tributário, as the SEFAZ defines it. */
export type FiscalTaxRegime =
  | 1 // Simples Nacional
  | 2 // Simples Nacional — excesso de sublimite de receita bruta
  | 3 // Regime Normal (Lucro Presumido / Lucro Real)
  | 4; // MEI

/**
 * Indicador de Inscrição Estadual do destinatário.
 *
 * Getting this wrong is the single most common NF-e rejection (código 805):
 * the destination SEFAZ refuses "isento" for recipients that are simply not
 * ICMS taxpayers. A natural person is `nao_contribuinte`, never `isento`.
 */
export type FiscalIeIndicator = "contribuinte" | "isento" | "nao_contribuinte";

export interface FiscalAddress {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  /** 7-digit IBGE municipality code. Mandatory on the wire, not derivable from the name. */
  codigoIbge: string;
  uf: string;
  cep: string;
}

/** The company issuing the document — a ProOps tenant, never ProOps itself. */
export interface FiscalIssuerConfig {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cnae?: string;
  regimeTributario: FiscalTaxRegime;
  email: string;
  telefone?: string;
  endereco: FiscalAddress;
  /** A1 certificate (.pfx/.p12) in base64. Never persisted by us — forwarded and dropped. */
  certificadoBase64: string;
  certificadoSenha: string;
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  /**
   * Recepção de notas emitidas CONTRA este CNPJ (notas de entrada).
   *
   * Nasce desligada de propósito: ligá-la faz o provedor começar a puxar as
   * notas recebidas, e **cada uma consome uma unidade do pacote mensal**. Não
   * faz sentido gastar unidades antes de existir tela para mostrá-las.
   */
  habilitaManifestacao?: boolean;
  /** Default `nacional`. Decide o recurso e o layout do payload de NFS-e. */
  padraoNfse?: FiscalNfsePadrao;
  /**
   * `regApTribSN` da DPS nacional — obrigatório quando o emitente é do Simples.
   *
   * 1 = tributos federais e municipal pelo SN (o caso comum, e o que a nota de
   * referência do primeiro emitente traz), 2 = federais pelo SN e ISSQN por
   * fora, 3 = ambos por fora. Depende de como o município cobra o ISS, então
   * fica sobrescrevível — mas nasce em 1 em vez de virar mais uma pergunta que
   * quem preenche não sabe responder.
   */
  regimeApuracaoSimplesNacional?: 1 | 2 | 3;
  /**
   * `regEspTrib` — a contrapartida para quem NÃO é do Simples. 0 = nenhum,
   * que cobre a esmagadora maioria; os outros são cooperativa, estimativa,
   * notário, autônomo, sociedade de profissionais.
   */
  regimeEspecialTributacao?: number;
  /**
   * `pTotTribSN` — percentual aproximado do total de tributos embutido na
   * alíquota do Simples Nacional, para a transparência da Lei 12.741/2012.
   *
   * `totTrib` é um CHOICE do leiaute: exatamente um entre `vTotTrib`,
   * `pTotTrib`, `indTotTrib` e `pTotTribSN`. Para **ME/EPP** o indicador é
   * proibido (rejeição **E0712**), então este é o único caminho — não existe
   * a opção de "não informar" que o Decreto 8.264/2014 dá aos demais.
   *
   * O número sai da alíquota efetiva do DAS e muda com o faturamento, então é
   * do tenant, não nosso: fica no cadastro em vez de virar pergunta a cada nota.
   */
  percentualTotalTributosSimplesNacional?: number;
  /**
   * `data_inicio_recebimento_nfe` — a partir de quando buscar notas recebidas.
   *
   * Não é detalhe técnico, é **controle de custo**: notas emitidas antes dela
   * são descartadas e NÃO cobradas; em branco, o provedor recupera todo o
   * histórico disponível e cobra por cada uma. E o provedor **não deixa
   * alterar depois de definida** — por isso ela é escolha do tenant, com o
   * custo dito na frente, e não um default silencioso nosso.
   */
  dataInicioRecebimento?: string;
  serieNfe?: number;
  proximoNumeroNfe?: number;
  serieNfse?: string;
  proximoNumeroNfse?: number;
}

/** Who receives the document. */
export interface FiscalRecipient {
  /** CPF (11) or CNPJ (14), digits only. */
  documento: string;
  nome: string;
  email?: string;
  telefone?: string;
  inscricaoEstadual?: string;
  indicadorIe: FiscalIeIndicator;
  /** Drives IBS/CBS credit rules from 2027 and some ICMS scenarios today. */
  consumidorFinal: boolean;
  endereco?: FiscalAddress;
}

/** A merchandise line. Everything here is required by the SEFAZ, not by us. */
export interface FiscalProductItem {
  codigo: string;
  descricao: string;
  /** 8-digit NCM. Also drives `cClassTrib` for IBS/CBS from 2027. */
  ncm: string;
  cest?: string;
  /** Depends on origin and destination UF, so it belongs to the operation, not the product. */
  cfop: string;
  /** 0–8: national, direct import, acquired domestically from an importer, etc. */
  origem: number;
  unidadeComercial: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  /** Já resolvido (`line-taxes.ts`): o provedor só copia. */
  icms: FiscalIcms;
  /** Obrigatórios em todo item da NF-e 4.00, mesmo zerados (rejeição 745). */
  pis: FiscalPisCofins;
  cofins: FiscalPisCofins;
  /** Ausente = a linha sai sem grupo de IPI, que é o caso de quase toda nota. */
  ipi?: FiscalIpi;
}

/**
 * ICMS de uma linha, com os valores já calculados.
 *
 * O Regime Normal informa CST e o Simples, CSOSN: `kind` diz qual, e os dois
 * vão no mesmo campo do provedor. Os números só existem quando o código os
 * aceita (`tax-codes.ts`).
 */
export interface FiscalIcms {
  kind: "csosn" | "cst";
  situacao: string;
  baseCalculo?: number;
  /** Percentual de redução da base. */
  reducaoBase?: number;
  aliquota?: number;
  valor?: number;
  /** `pCredSN`: alíquota do crédito que o destinatário aproveita (CSOSN 101 e 900). */
  aliquotaCredito?: number;
  /** `vCredICMSSN`. */
  valorCredito?: number;
}

/** PIS ou COFINS de uma linha (o leiaute dos dois é o mesmo). */
export interface FiscalPisCofins {
  cst: string;
  /** Ausentes no grupo de não tributado (CST 04 a 09). */
  baseCalculo?: number;
  aliquota?: number;
  valor?: number;
}

/**
 * IPI de uma linha da NF-e.
 *
 * Quase nenhum instalador destaca IPI, então nada aqui é derivado: só sai na
 * nota quando alguém pediu, na própria nota ou no padrão fiscal do contato.
 * O caso real que trouxe o campo: um cliente industrial exige o IPI informado
 * (com o CST que ele usa para recuperar o imposto) nas notas que recebe.
 *
 * O grupo do XML (`IPITrib` ou `IPINT`) é decidido pelo CST no provedor.
 */
export interface FiscalIpi {
  /** CST do IPI na saída: 50 tributada, 51 alíquota zero, 52 isenta, 53 não tributada, 54 imune, 55 suspensão, 99 outras. */
  cst: string;
  /** Percentual. Só nos CST tributados (50 e 99). */
  aliquota?: number;
  /** Padrão: o valor da linha. */
  baseCalculo?: number;
  /** Padrão: base × alíquota. */
  valor?: number;
  /** `cEnq`, obrigatório no grupo. 999 = sem enquadramento específico. */
  codigoEnquadramento?: string;
}

/** CST do IPI que levam base, alíquota e valor (grupo `IPITrib`). */
export const IPI_CST_TRIBUTADOS = new Set(["00", "49", "50", "99"]);

/** CST do IPI de saída aceitos na tela e na API. */
export const IPI_CST_SAIDA = ["50", "51", "52", "53", "54", "55", "99"] as const;

/**
 * `modFrete`: quem contrata o frete.
 * 0 remetente (CIF), 1 destinatário (FOB), 2 terceiros, 3 transporte próprio
 * do remetente, 4 transporte próprio do destinatário, 9 sem frete.
 */
export type FiscalModalidadeFrete = 0 | 1 | 2 | 3 | 4 | 9;

export interface FiscalTransportadora {
  nome: string;
  /** CPF (11) ou CNPJ (14), só dígitos. */
  documento?: string;
  inscricaoEstadual?: string;
  endereco?: string;
  municipio?: string;
  uf?: string;
}

export interface FiscalVolume {
  quantidade?: number;
  especie?: string;
  marca?: string;
  numeracao?: string;
  /** Quilos. */
  pesoBruto?: number;
  pesoLiquido?: number;
}

/** O bloco "Transportador/volumes transportados" do DANFE. */
export interface FiscalTransporte {
  modalidadeFrete: FiscalModalidadeFrete;
  transportadora?: FiscalTransportadora;
  volumes?: FiscalVolume[];
}

/** A service line. ISS is municipal, so the rate travels with the item. */
export interface FiscalServiceItem {
  descricao: string;
  /** Item da lista da LC 116/2003, e.g. "7.02", "14.06". */
  codigoLc116: string;
  /** Municipal code, when the city keeps its own list alongside the federal one. */
  codigoTributacaoMunicipio?: string;
  valorServicos: number;
  aliquotaIss: number;
  issRetido: boolean;
  /** NT 007/2026 — required on the NFS-e Nacional layout since 09/02/2026. */
  nbs?: string;
  codigoTributacaoNacional?: string;
}

export interface FiscalInvoiceInput {
  type: FiscalDocumentType;
  /** Our own reference, echoed back by the provider. The idempotency key. */
  ref: string;
  issuer: FiscalIssuerConfig;
  recipient: FiscalRecipient;
  /** Present when `type === "nfe"`. */
  products?: FiscalProductItem[];
  /** Present when `type === "nfse"`. */
  service?: FiscalServiceItem;
  naturezaOperacao?: string;
  observacoes?: string;
  /**
   * NF-e: textos que a lei manda constar, como o do crédito do Simples
   * (art. 23 da LC 123/2006). Ficam fora de `observacoes` de propósito: a
   * observação é texto livre que a pessoa reescreve inteiro na tela, e a
   * mensagem legal não pode sumir porque alguém apagou o campo.
   */
  mensagensLegais?: string[];
  dataEmissao: string;
  /** Na NF-e, inclui o IPI: o total da nota é produtos + IPI. */
  valorTotal: number;
  /** NF-e. Ausente = normal. */
  finalidade?: "normal" | "devolucao";
  /** NF-e: chaves de 44 dígitos das notas referenciadas (devolução, retorno). */
  notasReferenciadas?: string[];
  /** NF-e. Ausente = sem frete. */
  transporte?: FiscalTransporte;
}

/** Normalized result, identical in shape whichever provider produced it. */
export interface FiscalInvoiceResult {
  ref: string;
  status: FiscalInvoiceStatus;
  type: FiscalDocumentType;
  numero?: string;
  serie?: string;
  /** NF-e only — the 44-digit access key. */
  chaveAcesso?: string;
  /** NF-e only. */
  protocolo?: string;
  /** NFS-e only. */
  codigoVerificacao?: string;
  /** Provider-hosted PDF (DANFE or DANFSe). Mirrored to our Storage once authorized. */
  pdfUrl?: string;
  xmlUrl?: string;
  /**
   * Documentos da CARTA DE CORRECAO, quando a resposta os traz.
   *
   * Sao de um EVENTO, nao da nota: a NF-e nao muda com a CC-e e o DANFE nao
   * carrega a correcao. A guarda legal de 5 anos vale para o evento tambem.
   */
  correcaoXmlUrl?: string;
  correcaoPdfUrl?: string;
  correcaoNumero?: string;
  /** Public verification page, when the municipality exposes one. */
  publicUrl?: string;
  /** Raw provider/SEFAZ code, kept for the humanized error dictionary. */
  rejectionCode?: string;
  rejectionMessage?: string;
}

export interface FiscalIssuerResult {
  providerIssuerId?: string;
  cnpj: string;
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  /**
   * Credentials the provider mints for this company, one per environment.
   *
   * Issuing uses these, never the account-level token — so a bug cannot emit
   * under another tenant's CNPJ. Stored KMS-encrypted; absent on a dry run,
   * which does not create the company.
   */
  tokenHomologacao?: string;
  tokenProducao?: string;
  /**
   * Validade do certificado, lida do próprio arquivo pelo provedor.
   *
   * Melhor que pedir ao usuário: a data está dentro do `.pfx`, e digitá-la
   * errado faria o alerta de vencimento avisar na data errada — que é
   * exatamente quando ele não pode falhar.
   */
  certificadoValidoAte?: string;
  /** CNPJ que o provedor leu do certificado — confere com o cadastrado. */
  certificadoCnpj?: string;
}

/**
 * A status no later event may move away from.
 *
 * Provider webhooks are not ordered. Without this guard a delayed
 * `processando_autorizacao` can arrive after `autorizado` and walk an
 * authorized invoice backwards.
 */
export function isTerminalInvoiceStatus(status: FiscalInvoiceStatus): boolean {
  return status === "authorized" || status === "cancelled" || status === "rejected";
}
