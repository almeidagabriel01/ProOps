/**
 * O que conta no armazenamento do plano (`storageQuotaMB`).
 *
 * So o que a empresa SOBE: imagens de produto e servico, imagens e anexos de
 * proposta. Fica de fora o que o sistema gera por conta propria:
 *
 * - `.../pdf/...` (cache do PDF da proposta e do recibo): e regenerado sob
 *   demanda, cobrar por ele seria cobrar por uma otimizacao nossa;
 * - `fiscal/` (XML e DANFE arquivados): guarda legal de 5 anos, o cliente nao
 *   pode ser impedido de cumprir a lei por falta de espaco;
 * - `transactions/` (recibos, tambem gerados).
 *
 * Arquivo puro: e lido pelos gatilhos de Storage, pelo leitor de uso do plano
 * e pelo script de backfill, que precisam concordar sobre o mesmo conjunto.
 */

export const STORAGE_USAGE_COLLECTION = "tenant_storage_usage";

const COUNTED_FOLDERS = new Set(["products", "services", "proposals"]);

const BYTES_PER_MB = 1024 * 1024;

/** Tenant dono do arquivo, se o arquivo conta no armazenamento; senao null. */
export function tenantForCountedPath(path: string): string | null {
  const parts = String(path || "").split("/");
  // tenants/{tenantId}/{folder}/...{fileName}
  if (parts.length < 4 || parts[0] !== "tenants") return null;
  const [, tenantId, folder] = parts;
  if (!tenantId || !COUNTED_FOLDERS.has(folder)) return null;
  if (parts.slice(3, -1).includes("pdf")) return null;
  return tenantId;
}

export function bytesToMb(bytes: number): number {
  return Math.max(0, Number(bytes) || 0) / BYTES_PER_MB;
}

/** `-1` e ilimitado. No teto ja conta como estourado: o proximo upload passaria. */
export function isOverStorageQuota(storageBytes: number, quotaMb: number): boolean {
  if (quotaMb === -1) return false;
  return bytesToMb(storageBytes) >= quotaMb;
}
