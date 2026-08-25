/**
 * Fiscal fields carried by catalogue entries (`products` and `services`).
 *
 * These are **optional at cadastro and required at issue time**. Nobody has to
 * stop and classify an existing catalogue before using the ERP; the gate is
 * `fiscal-readiness.ts`, which runs when a document is actually issued and
 * names every gap at once.
 *
 * The list is deliberately short. CFOP, CST/CSOSN and the commercial unit are
 * *not* here — they are derived at issue time (see `natureza-operacao.ts`),
 * because they depend on the operation and the issuer's regime rather than on
 * the item. Storing them per product is what forces a manual fix on every
 * interstate sale.
 */

/** Fiscal attributes of a merchandise item. */
export interface ProductFiscalFields {
  /** 8 digits, no punctuation. The one field with no default and no derivation. */
  ncm?: string;
  /** 7 digits. Only exists for goods under substituição tributária. */
  cest?: string;
  /** 0 national … 8. Defaults to national. */
  origem?: number;
  /**
   * Overrides the CST/CSOSN derived from the issuer's regime. Set only for the
   * exceptions — substituição tributária, exemptions, tax benefits.
   */
  situacaoTributaria?: string;
}

/** Fiscal attributes of a service item. */
export interface ServiceFiscalFields {
  /** Item da lista da LC 116/2003, e.g. "7.02", "14.06". */
  codigoLc116?: string;
  /** Municipal code, when the city keeps its own list alongside the federal one. */
  codigoTributacaoMunicipio?: string;
  /** ISS rate in percent — municipal, typically 2 to 5. */
  aliquotaIss?: number;
  issRetido?: boolean;
  /** NT 007/2026 — required on the NFS-e Nacional layout since 09/02/2026. */
  nbs?: string;
  codigoTributacaoNacional?: string;
  /** IBS/CBS classification, mandatory for Simples and MEI from 04/01/2027. */
  classificacaoIbsCbs?: string;
  indicadorOperacao?: string;
}

function digitsOnly(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const digits = String(value).replace(/\D/g, "").slice(0, maxLength);
  return digits || undefined;
}

function shortText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}

const ORIGEM_MAX = 8;
const NCM_LENGTH = 8;
const CEST_LENGTH = 7;

/**
 * Normalizes the fiscal fields of a product.
 *
 * Only keys actually present in the input are returned, so a partial update
 * never clears a field the caller did not mention. An explicit empty string
 * yields `null`, which the controller turns into a Firestore delete — that is
 * how a user removes a wrong NCM.
 */
export function sanitizeProductFiscalFields(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if ("ncm" in input) {
    out.ncm = input.ncm === "" ? null : (digitsOnly(input.ncm, NCM_LENGTH) ?? null);
  }
  if ("cest" in input) {
    out.cest = input.cest === "" ? null : (digitsOnly(input.cest, CEST_LENGTH) ?? null);
  }
  if ("situacaoTributaria" in input) {
    out.situacaoTributaria =
      input.situacaoTributaria === ""
        ? null
        : (digitsOnly(input.situacaoTributaria, 3) ?? null);
  }
  if ("origem" in input) {
    const parsed = Number(input.origem);
    // Out-of-range or unparseable means national — the case for anyone buying
    // from a domestic distributor, which is the whole niche.
    out.origem =
      Number.isInteger(parsed) && parsed >= 0 && parsed <= ORIGEM_MAX ? parsed : 0;
  }

  return out;
}

/** Same contract as `sanitizeProductFiscalFields`, for services. */
export function sanitizeServiceFiscalFields(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const textFields: Array<[keyof ServiceFiscalFields, number]> = [
    ["codigoLc116", 10],
    ["codigoTributacaoMunicipio", 30],
    ["nbs", 20],
    ["codigoTributacaoNacional", 20],
    ["classificacaoIbsCbs", 20],
    ["indicadorOperacao", 20],
  ];
  for (const [field, maxLength] of textFields) {
    if (field in input) {
      out[field] = input[field] === "" ? null : (shortText(input[field], maxLength) ?? null);
    }
  }

  if ("aliquotaIss" in input) {
    const parsed = Number(input.aliquotaIss);
    // Zero is a legitimate rate in some municipalities, so only an
    // unparseable or out-of-range value is discarded.
    out.aliquotaIss =
      Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
  }

  if ("issRetido" in input) {
    out.issRetido = input.issRetido === true;
  }

  return out;
}
