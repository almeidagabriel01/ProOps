import { isDocumentoValido } from "@/lib/format-document";

/**
 * Os campos que cada importação aceita, com os nomes de coluna que costumam
 * aparecer nas planilhas (para ligar sozinho) e a validação da prévia.
 *
 * A validação daqui só roda na conta de demonstração, que não chama a API. Para
 * quem assina, a prévia é a do servidor (`dryRun`), que também acha repetidos.
 */

export type ImportKind = "clients" | "products" | "services";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  /** Outros nomes de coluna que querem dizer este campo. */
  synonyms: string[];
  example: string;
}

export type ImportRow = Record<string, string>;

export const CONTACT_FIELDS: ImportField[] = [
  { key: "name", label: "Nome", required: true, synonyms: ["nome completo", "razao social", "cliente", "contato", "name"], example: "Ana Ribeiro" },
  { key: "types", label: "Tipo", synonyms: ["tipos", "categoria"], example: "cliente" },
  { key: "document", label: "CPF/CNPJ", synonyms: ["cpf", "cnpj", "documento", "cpf cnpj", "cpf/cnpj"], example: "529.982.247-25" },
  { key: "email", label: "E-mail", synonyms: ["email", "e mail", "correio"], example: "ana@exemplo.com" },
  { key: "phone", label: "Telefone", synonyms: ["celular", "whatsapp", "fone", "telefone celular", "tel"], example: "(11) 98888-7777" },
  { key: "address", label: "Endereço", synonyms: ["endereco", "logradouro", "endereco completo"], example: "Rua das Flores, 100, São Paulo, SP" },
  { key: "notes", label: "Observações", synonyms: ["observacoes", "obs", "notas", "anotacoes"], example: "" },
];

export function productFields(options: { inventoryLabel: string; perMeter: boolean }): ImportField[] {
  return [
    { key: "name", label: "Nome", required: true, synonyms: ["produto", "descricao do produto", "nome do produto", "item"], example: options.perMeter ? "Linho cru" : "Sensor de presença" },
    { key: "category", label: "Categoria", synonyms: ["grupo", "linha", "familia"], example: options.perMeter ? "Tecidos" : "Sensores" },
    { key: "manufacturer", label: "Fabricante", synonyms: ["marca", "fornecedor"], example: options.perMeter ? "Tecelagem Sul" : "Intelbras" },
    { key: "description", label: "Descrição", synonyms: ["descricao", "detalhes"], example: "" },
    { key: "price", label: "Preço", required: true, synonyms: ["preco", "valor", "preco de venda", "valor unitario", "preco unitario"], example: options.perMeter ? "80,00" : "189,90" },
    { key: "markup", label: "Markup (%)", synonyms: ["markup", "margem", "margem (%)"], example: "30" },
    { key: "stock", label: options.inventoryLabel, synonyms: ["estoque", "quantidade", "qtd", "metragem", "saldo"], example: options.perMeter ? "120" : "15" },
    ...(options.perMeter
      ? [{ key: "pricePer", label: "Preço por", synonyms: ["cobranca", "unidade de venda", "preco por"], example: "metro" }]
      : []),
    { key: "ncm", label: "NCM", synonyms: ["ncm/sh"], example: "" },
  ];
}

export const SERVICE_FIELDS: ImportField[] = [
  { key: "name", label: "Nome", required: true, synonyms: ["servico", "nome do servico", "descricao do servico"], example: "Instalação" },
  { key: "category", label: "Categoria", synonyms: ["grupo", "tipo"], example: "Mão de obra" },
  { key: "description", label: "Descrição", synonyms: ["descricao", "detalhes"], example: "" },
  { key: "price", label: "Preço", required: true, synonyms: ["preco", "valor"], example: "350,00" },
];

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[*:]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Liga cada campo à coluna da planilha pelo nome (ou por um sinônimo). Cada
 * coluna serve a um campo só; -1 é "não importar".
 */
export function autoMap(headers: string[], fields: ImportField[]): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: Record<string, number> = {};
  for (const field of fields) {
    const names = [field.label, field.key, ...field.synonyms].map(normalizeHeader);
    const index = normalized.findIndex((h, i) => !used.has(i) && names.includes(h));
    mapping[field.key] = index;
    if (index >= 0) used.add(index);
  }
  return mapping;
}

/** As linhas da planilha como objetos do campo, pela ligação escolhida. */
export function buildImportRows(rows: string[][], mapping: Record<string, number>): ImportRow[] {
  return rows
    .map((row) => {
      const result: ImportRow = {};
      for (const [key, index] of Object.entries(mapping)) {
        if (index >= 0) result[key] = String(row[index] ?? "").trim();
      }
      return result;
    })
    .filter((row) => Object.values(row).some((v) => v !== ""));
}

function parseNumber(value: string): number {
  let s = value.trim().replace(/^R\$\s*/i, "").replace(/%$/, "").replace(/\s/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

/** Validação da prévia da demonstração (ver o topo do arquivo). */
export function validateLocally(kind: ImportKind, row: ImportRow): string | null {
  if ((row.name ?? "").trim().length < 2) return "Nome obrigatório.";
  if (kind === "clients") {
    if (row.document && !isDocumentoValido(row.document)) return "CPF ou CNPJ inválido.";
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return "E-mail inválido.";
    return null;
  }
  const price = parseNumber(row.price ?? "");
  if (!Number.isFinite(price) || price <= 0) return "Preço obrigatório e maior que zero.";
  return null;
}
