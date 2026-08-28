/**
 * Datas e horas dos documentos fiscais, no fuso de Brasília.
 *
 * Existe por causa de uma rejeição real. Mandávamos a data de emissão em UTC:
 *
 *   enviado    <dhEmi>2026-08-28T03:08:00+00:00</dhEmi>
 *   processado 2026-08-28T00:08:05.336-03:00
 *
 * Os dois são o **mesmo instante** — a emissão aconteceu 5 segundos antes do
 * processamento. Mas o Ambiente Nacional comparou os relógios de parede, viu
 * `03:08` contra `00:08` e devolveu:
 *
 *   E0008 — A data de emissão da DPS não pode ser posterior à data do seu
 *           processamento.
 *
 * Enviar com o deslocamento de Brasília satisfaz as duas leituras: quem compara
 * instantes acerta, e quem compara texto também.
 *
 * O Brasil não tem mais horário de verão desde o Decreto 9.772/2019, então
 * −03:00 é fixo e não precisa de banco de fusos. Se voltar, este é o arquivo a
 * mudar — e o único.
 */

/** Brasília em relação ao UTC, em minutos. Fixo desde 2019. */
const BRASILIA_OFFSET_MINUTES = -180;

/**
 * Instante atual (ou o informado) como ISO 8601 com o deslocamento de Brasília.
 *
 * Ex.: `2026-08-28T00:08:05-03:00`.
 */
export function toBrasiliaIso(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + BRASILIA_OFFSET_MINUTES * 60_000);
  // `toISOString` sempre imprime em UTC; deslocamos antes e trocamos o sufixo,
  // que é o jeito de produzir o horário local sem depender de Intl nem do fuso
  // da máquina — o Cloud Run roda em UTC.
  return `${shifted.toISOString().slice(0, 19)}-03:00`;
}

/**
 * Parte de data (`YYYY-MM-DD`) de um instante, **no fuso de Brasília**.
 *
 * Não é `slice(0, 10)` do ISO em UTC: uma nota emitida às 22h de Brasília tem
 * `T01:00Z` do dia seguinte, e a competência sairia um dia à frente. O erro
 * aparece só entre 21h e meia-noite, que é exatamente quando ninguém testa.
 */
export function brasiliaDatePart(iso: string): string {
  const text = String(iso).trim();

  // `YYYY-MM-DD` puro é uma data de CALENDÁRIO, não um instante. `new Date()`
  // a interpreta como meia-noite em UTC, e o deslocamento a jogaria para o dia
  // anterior — transformando uma data já correta em errada.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    // Entrada inesperada não pode derrubar a emissão; o gate já barrou o que
    // era barrável e o provedor valida o formato de novo.
    return text.slice(0, 10);
  }
  return toBrasiliaIso(parsed).slice(0, 10);
}
