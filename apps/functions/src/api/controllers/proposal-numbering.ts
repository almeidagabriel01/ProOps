/**
 * Numeracao sequencial de proposta.
 *
 * O formato pedido pelo cliente que originou isto e `0018926SP`: cinco digitos
 * sequenciais, dois digitos do ano e a praca. O arquivo entregue no Drive
 * concatena o titulo: `0018926SP_casa_do_mauricio.pdf`.
 *
 * Duas decisoes de fundo:
 *
 * 1. **O identificador NAO inclui o titulo.** Titulo muda; numero de documento
 *    nao. `proposalCode` guarda so `0018926SP`, e o nome do arquivo e derivado
 *    na hora. Guardar o titulo dentro do codigo faria o identificador de uma
 *    proposta ja enviada ao cliente mudar junto com uma correcao de digitacao.
 * 2. **Nada aqui e fixo no codigo.** O formato de um cliente nao pode virar
 *    regra do produto: digitos, reinicio anual e a lista de pracas sao
 *    configuracao por empresa, e a numeracao inteira nasce DESLIGADA.
 */

export const DEFAULT_NUMBERING_DIGITS = 5;
export const MIN_NUMBERING_DIGITS = 1;
export const MAX_NUMBERING_DIGITS = 10;

/** Teto de seguranca da lista de pracas; ninguem opera com mais que isso. */
export const MAX_PRACAS = 30;
export const MAX_PRACA_LENGTH = 8;

export type ProposalNumberingConfig = {
  /** Nasce desligada: quem nao pediu numeracao nao ganha um codigo no titulo. */
  enabled: boolean;
  /** Quantos digitos o sequencial ocupa (com zeros a esquerda). */
  digits: number;
  /**
   * `false` = o sequencial atravessa o ano (00189 vira 00190 em janeiro).
   * `true` = volta para 1 a cada ano, e o ano no codigo e o que separa.
   */
  resetYearly: boolean;
  /** Siglas que a empresa usa, ex. ["SP", "RJ"]. Vazio = codigo sem praca. */
  pracas: string[];
  /** Sugerida na proposta nova. Precisa estar em `pracas`. */
  defaultPraca: string | null;
  /** Proximo numero a ser entregue. */
  nextNumber: number;
  /** Ano do `nextNumber`, usado so quando `resetYearly`. */
  year: number;
};

export const DEFAULT_NUMBERING_CONFIG: ProposalNumberingConfig = {
  enabled: false,
  digits: DEFAULT_NUMBERING_DIGITS,
  resetYearly: false,
  pracas: [],
  defaultPraca: null,
  nextNumber: 1,
  year: new Date().getFullYear(),
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Normaliza uma sigla de praca: maiusculas, so letras e digitos.
 *
 * Sem isso a mesma praca entraria como "SP", "sp" e "S.P." e o codigo perderia
 * exatamente a consistencia que justifica ele existir.
 */
export function normalizePraca(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, MAX_PRACA_LENGTH);
}

/** Le e sanea o que veio do formulario ou do documento gravado. */
export function sanitizeNumberingConfig(
  value: unknown,
): ProposalNumberingConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;

  const pracas: string[] = [];
  if (Array.isArray(raw.pracas)) {
    for (const item of raw.pracas) {
      const praca = normalizePraca(item);
      if (!praca || pracas.includes(praca)) continue;
      pracas.push(praca);
      if (pracas.length >= MAX_PRACAS) break;
    }
  }

  const defaultPraca = normalizePraca(raw.defaultPraca);

  return {
    enabled: Boolean(raw.enabled),
    digits: clampInt(
      raw.digits,
      MIN_NUMBERING_DIGITS,
      MAX_NUMBERING_DIGITS,
      DEFAULT_NUMBERING_DIGITS,
    ),
    resetYearly: Boolean(raw.resetYearly),
    pracas,
    // Uma praca padrao fora da lista viraria um codigo com sigla que a empresa
    // nao reconhece.
    defaultPraca: defaultPraca && pracas.includes(defaultPraca) ? defaultPraca : null,
    nextNumber: clampInt(raw.nextNumber, 1, Number.MAX_SAFE_INTEGER, 1),
    year: clampInt(raw.year, 1970, 9999, new Date().getFullYear()),
  };
}

/**
 * Monta o identificador: sequencial + dois digitos do ano + praca.
 *
 * A praca entra so se a proposta tiver uma. Empresa que nao usa praca fica com
 * `0018926`, que continua sendo um identificador valido.
 */
export function buildProposalCode(params: {
  number: number;
  year: number;
  praca?: string | null;
  digits?: number;
}): string {
  const digits = clampInt(
    params.digits,
    MIN_NUMBERING_DIGITS,
    MAX_NUMBERING_DIGITS,
    DEFAULT_NUMBERING_DIGITS,
  );
  const sequencial = String(Math.max(1, Math.floor(params.number))).padStart(
    digits,
    "0",
  );
  const ano = String(params.year % 100).padStart(2, "0");
  const praca = normalizePraca(params.praca);
  return `${sequencial}${ano}${praca}`;
}

/**
 * Slug do titulo para o nome do arquivo: minusculas, sem acento, `_` no lugar
 * do espaco. E o formato que o cliente ja usa no acervo dele.
 */
export function slugifyProposalTitle(title: unknown): string {
  return String(title ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/**
 * Decide qual numero esta proposta recebe, dado o estado atual do contador.
 *
 * Funcao pura de proposito: a alocacao acontece dentro de uma transacao do
 * Firestore, e a regra de "quando reiniciar" nao pode viver dentro dela, senao
 * so da para testar com emulador.
 *
 * O numero e QUEIMADO: apagar a proposta nao devolve o numero para a fila.
 * Renumerar as seguintes mudaria o identificador de documento ja enviado ao
 * cliente, que e pior que um buraco na sequencia.
 */
export function allocateNextNumber(
  config: ProposalNumberingConfig,
  currentYear: number,
): { number: number; year: number; nextState: { nextNumber: number; year: number } } {
  const reinicia = config.resetYearly && config.year !== currentYear;
  const number = reinicia ? 1 : config.nextNumber;
  const year = currentYear;

  return {
    number,
    year,
    nextState: { nextNumber: number + 1, year },
  };
}
