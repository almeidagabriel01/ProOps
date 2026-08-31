/**
 * Faixas de série da DPS na NFS-e Nacional.
 *
 * A série não é livre: ela **identifica o sistema emissor** perante o Ambiente
 * Nacional, e cada tipo tem sua faixa reservada. Série fora da faixa é rejeição
 * **E0010** ("a série informada na DPS não pertence à faixa definida para o
 * tipo de emissor").
 *
 *   00001–49999   aplicativo próprio  ← a ProOps
 *   50000–69999   emissor mobile
 *   70000–79999   emissor web (o portal nfse.gov.br)
 *   80000–89999   transcrição manual
 *
 * Isso tem uma consequência boa e não óbvia: quem emite hoje pelo portal usa
 * uma série da faixa 70000, e migrar para cá **exige** trocar de série. Séries
 * diferentes têm numeração independente, então a nova começa do 1 sem risco de
 * duplicidade com o que já foi emitido pelo portal.
 */

export const SERIE_APP_PROPRIO_MIN = 1;
export const SERIE_APP_PROPRIO_MAX = 49999;

/** Fora da faixa de aplicativo próprio, com o motivo — ou `null` se estiver ok. */
export function validarSerieNfse(serie: string): string | null {
  const texto = String(serie ?? "").trim();
  if (!texto) return null;

  const numero = Number(texto.replace(/\D/g, ""));
  if (!Number.isInteger(numero) || numero < SERIE_APP_PROPRIO_MIN) {
    return `A série precisa ser um número entre ${SERIE_APP_PROPRIO_MIN} e ${SERIE_APP_PROPRIO_MAX}.`;
  }

  if (numero > SERIE_APP_PROPRIO_MAX) {
    if (numero >= 70000 && numero <= 79999) {
      return "Essa faixa é do emissor web (portal nfse.gov.br). Para emitir por aqui, use uma série entre 1 e 49999 — a numeração dela começa do zero, sem conflito com as notas do portal.";
    }
    return `Série fora da faixa de aplicativo próprio (${SERIE_APP_PROPRIO_MIN} a ${SERIE_APP_PROPRIO_MAX}).`;
  }

  return null;
}
