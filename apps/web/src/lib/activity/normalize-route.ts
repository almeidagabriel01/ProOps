/**
 * Espelho de `apps/functions/src/shared/activity-route.ts`: troca todo
 * segmento com cara de id por `[id]` e tira query e hash, para a rota não
 * levar dado de cliente nem espalhar a mesma tela em mil variações. O
 * servidor normaliza de novo; `src/__tests__/activity-catalog-parity.test.ts`
 * roda os mesmos casos nas duas cópias.
 */

export const ACTIVITY_ROUTE_MAX = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HAS_DIGIT = /\d/;
const HAS_UPPER = /[A-Z]/;
const SAFE_SEGMENT = /^[A-Za-z0-9_.-]+$/;

function normalizeSegment(segment: string): string {
  if (!segment) return segment;
  if (/^\d+$/.test(segment)) return "[id]";
  if (UUID.test(segment)) return "[id]";
  if (segment.length >= 8 && HAS_DIGIT.test(segment)) return "[id]";
  // id do Firestore e token: longos e com maiúscula. Rota de tela é minúscula
  // com hífen (`automacao-residencial`) e precisa sobreviver.
  if (segment.length >= 16 && HAS_UPPER.test(segment)) return "[id]";
  if (!SAFE_SEGMENT.test(segment)) return "[id]";
  return segment;
}

export function normalizeActivityRoute(path: unknown): string | null {
  if (typeof path !== "string") return null;
  const withoutQuery = path.split(/[?#]/, 1)[0].trim();
  if (!withoutQuery.startsWith("/")) return null;
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // caminho com escape inválido: segue cru, e o segmento vira [id] abaixo
  }
  const normalized = decoded
    .split("/")
    .map(normalizeSegment)
    .join("/")
    .replace(/\/{2,}/g, "/");
  const trimmed = normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
  return trimmed.slice(0, ACTIVITY_ROUTE_MAX);
}
