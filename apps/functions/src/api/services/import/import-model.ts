import { cnpj, cpf } from "cpf-cnpj-validator";

/**
 * Importação por planilha: a linha que a tela mandou, já com as colunas
 * ligadas aos campos, validada pelas mesmas regras do cadastro manual. Puro.
 *
 * Repetido não é importado (decisão do produto): contato com o mesmo CPF/CNPJ,
 * e-mail ou telefone de um que já existe, ou de uma linha anterior da mesma
 * planilha; produto e serviço com o mesmo nome.
 */

export type RawRow = Record<string, unknown>;

export type RowResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const MAX_ROWS_PER_REQUEST = 500;

export const CONTACT_TYPES = ["cliente", "fornecedor", "vendedor", "arquiteto"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

function text(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function longText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Número como vem de planilha brasileira: 1234.5, "1.234,50", "R$ 1.234,50",
 * "12,5%". Vazio é nulo; texto que não é número é NaN.
 */
export function parseBrazilianNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  let s = String(value).trim().replace(/^R\$\s*/i, "").replace(/%$/, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** "Cliente, Fornecedor" -> ["cliente", "fornecedor"]; vazio -> cliente. */
export function parseContactTypes(value: unknown): ContactType[] | null {
  const parts = String(value ?? "")
    .split(/[,;/|]/)
    .map((p) => normalizeKey(p))
    .filter(Boolean);
  if (parts.length === 0) return ["cliente"];
  const types: ContactType[] = [];
  for (const part of parts) {
    const found = CONTACT_TYPES.find((t) => part === t || part === `${t}s` || part === `${t}es`);
    if (!found) return null;
    if (!types.includes(found)) types.push(found);
  }
  return types;
}

export interface ClientImportValue {
  name: string;
  types: ContactType[];
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export function validateClientRow(row: RawRow): RowResult<ClientImportValue> {
  const name = text(row.name, 200);
  if (name.length < 2) return { ok: false, error: "Nome obrigatório." };
  const types = parseContactTypes(row.types);
  if (!types) return { ok: false, error: "Tipo inválido: use cliente, fornecedor, vendedor ou arquiteto." };
  const value: ClientImportValue = { name, types };

  const doc = digits(row.document);
  if (doc) {
    const valid = doc.length === 11 ? cpf.isValid(doc) : doc.length === 14 ? cnpj.isValid(doc) : false;
    if (!valid) return { ok: false, error: "CPF ou CNPJ inválido." };
    value.document = doc;
  }
  const email = text(row.email, 254).toLowerCase();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "E-mail inválido." };
    value.email = email;
  }
  const phone = text(row.phone, 30);
  if (phone) {
    if (digits(phone).length < 8) return { ok: false, error: "Telefone inválido." };
    value.phone = phone;
  }
  const address = longText(row.address, 500);
  if (address) value.address = address;
  const notes = longText(row.notes, 2000);
  if (notes) value.notes = notes;
  return { ok: true, value };
}

/** As chaves que dizem que dois contatos são o mesmo. */
export function clientKeys(value: { document?: unknown; email?: unknown; phone?: unknown }): string[] {
  const keys: string[] = [];
  const doc = digits(value.document);
  if (doc.length === 11 || doc.length === 14) keys.push(`doc:${doc}`);
  const email = normalizeKey(value.email);
  if (email.includes("@")) keys.push(`email:${email}`);
  const phone = digits(value.phone).replace(/^55(?=\d{10,11}$)/, "");
  if (phone.length >= 10) keys.push(`phone:${phone}`);
  return keys;
}

export interface ProductImportValue {
  name: string;
  category: string;
  manufacturer: string;
  description: string;
  price: number;
  markup: string;
  stock: number;
  /** Preço por metro (cortinas). O resto é por unidade. */
  perMeter: boolean;
  ncm?: string;
}

export function validateProductRow(row: RawRow, options: { allowPerMeter: boolean }): RowResult<ProductImportValue> {
  const name = text(row.name, 200);
  if (name.length < 2) return { ok: false, error: "Nome obrigatório." };
  const price = parseBrazilianNumber(row.price);
  if (price === null || Number.isNaN(price) || price <= 0) return { ok: false, error: "Preço obrigatório e maior que zero." };
  const markup = parseBrazilianNumber(row.markup);
  if (markup !== null && (Number.isNaN(markup) || markup < 0 || markup > 1000)) {
    return { ok: false, error: "Markup inválido (de 0 a 1000%)." };
  }
  const stock = parseBrazilianNumber(row.stock);
  if (stock !== null && (Number.isNaN(stock) || stock < 0)) return { ok: false, error: "Estoque inválido." };
  const per = normalizeKey(row.pricePer);
  let perMeter = false;
  if (options.allowPerMeter) {
    if (!per || per.startsWith("met") || per === "m") perMeter = true;
    else if (per.startsWith("uni") || per === "un") perMeter = false;
    else return { ok: false, error: "Preço por: use metro ou unidade." };
  }
  const ncm = digits(row.ncm);
  if (ncm && ncm.length !== 8) return { ok: false, error: "NCM tem 8 dígitos." };
  return {
    ok: true,
    value: {
      name,
      category: text(row.category, 100),
      manufacturer: text(row.manufacturer, 100),
      description: longText(row.description, 2000),
      price: Math.round(price * 100) / 100,
      markup: String(markup ?? 0),
      stock: stock ?? 0,
      perMeter,
      ...(ncm ? { ncm } : {}),
    },
  };
}

export interface ServiceImportValue {
  name: string;
  category: string;
  description: string;
  price: number;
}

export function validateServiceRow(row: RawRow): RowResult<ServiceImportValue> {
  const name = text(row.name, 200);
  if (name.length < 2) return { ok: false, error: "Nome obrigatório." };
  const price = parseBrazilianNumber(row.price);
  if (price === null || Number.isNaN(price) || price <= 0) return { ok: false, error: "Preço obrigatório e maior que zero." };
  return {
    ok: true,
    value: {
      name,
      category: text(row.category, 100),
      description: longText(row.description, 2000),
      price: Math.round(price * 100) / 100,
    },
  };
}

export type ImportRowStatus = "ok" | "duplicate" | "error";

export interface ImportRowReport {
  /** Posição da linha no lote que chegou (0 = primeira). */
  index: number;
  status: ImportRowStatus;
  message?: string;
}

/**
 * Valida o lote e marca repetido: contra o que já existe (`existingKeys`) e
 * contra as linhas anteriores da mesma planilha.
 */
export function planImport<T>(
  rows: RawRow[],
  validate: (row: RawRow) => RowResult<T>,
  keysOf: (value: T) => string[],
  existingKeys: ReadonlySet<string>,
): { reports: ImportRowReport[]; accepted: Array<{ index: number; value: T }> } {
  const seen = new Set<string>();
  const reports: ImportRowReport[] = [];
  const accepted: Array<{ index: number; value: T }> = [];
  rows.forEach((row, index) => {
    const result = validate(row);
    if (!result.ok) {
      reports.push({ index, status: "error", message: result.error });
      return;
    }
    const keys = keysOf(result.value);
    if (keys.some((k) => existingKeys.has(k))) {
      reports.push({ index, status: "duplicate", message: "Já existe no cadastro." });
      return;
    }
    if (keys.some((k) => seen.has(k))) {
      reports.push({ index, status: "duplicate", message: "Repetido na planilha." });
      return;
    }
    keys.forEach((k) => seen.add(k));
    reports.push({ index, status: "ok" });
    accepted.push({ index, value: result.value });
  });
  return { reports, accepted };
}
