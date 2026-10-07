/**
 * As ações finas da proposta (catálogo de permissões, página `proposals`):
 * o que conta como "dar desconto", "trocar o responsável" e "mexer nas
 * comissões" numa gravação. Puro, para o controller e os testes.
 *
 * O formulário reenvia a proposta inteira, então vale o VALOR mudado, não a
 * presença do campo: quem não pode dar desconto continua salvando a proposta
 * que já tinha um.
 */

const roundCents = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/** `closedValue` vazio e zero são o mesmo "sem valor fechado". */
const closedValueOf = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = roundCents(value);
  return n > 0 ? n : null;
};

export function discountChanged(
  current: { discount?: unknown; closedValue?: unknown } | null,
  input: { discount?: unknown; closedValue?: unknown },
): boolean {
  if (input.discount !== undefined && roundCents(input.discount) !== roundCents(current?.discount)) {
    return true;
  }
  return (
    input.closedValue !== undefined && closedValueOf(input.closedValue) !== closedValueOf(current?.closedValue)
  );
}

const idsKey = (value: unknown): string =>
  (Array.isArray(value) ? value.map(String) : []).slice().sort().join("|");

/**
 * Trocar o responsável pela venda ou os parceiros. Na criação o "atual" é
 * quem cria (o padrão do formulário) e nenhum parceiro herdado conta: os
 * parceiros que a tela traz do cadastro do cliente vêm em `inheritedPartners`.
 */
export function sellerChanged(
  current: { sellerId?: unknown; partnerContactIds?: unknown },
  input: { sellerId?: unknown; partnerContactIds?: unknown },
): boolean {
  if (input.sellerId !== undefined && (input.sellerId || null) !== (current.sellerId || null)) return true;
  return (
    input.partnerContactIds !== undefined && idsKey(input.partnerContactIds) !== idsKey(current.partnerContactIds)
  );
}

export interface CommissionLine {
  contactId: string;
  role: string;
  percentage: number;
}

const lineKey = (line: CommissionLine) => `${line.contactId}:${line.role}`;

/**
 * Sem "Editar comissões", a mudança só passa se for a automática: a comissão
 * do vendedor que entra ou sai junto com o responsável, no percentual do
 * cadastro dele. Qualquer outra (percentual digitado, arquiteto escolhido à
 * mão, linha removida) pede a permissão.
 *
 * `registry` é o percentual de cada contato no cadastro (`commissionPercentage`).
 */
export function commissionsChangeIsAutomatic(
  before: readonly CommissionLine[],
  after: readonly CommissionLine[],
  registry: ReadonlyMap<string, number>,
): boolean {
  const old = new Map(before.map((line) => [lineKey(line), line]));
  const next = new Map(after.map((line) => [lineKey(line), line]));
  for (const [key, line] of next) {
    const was = old.get(key);
    if (was && roundCents(was.percentage) === roundCents(line.percentage)) continue;
    if (line.role !== "vendedor") return false;
    if (roundCents(registry.get(line.contactId)) !== roundCents(line.percentage)) return false;
  }
  for (const [key, line] of old) {
    if (!next.has(key) && line.role !== "vendedor") return false;
  }
  return true;
}

export function commissionsChanged(before: readonly CommissionLine[], after: readonly CommissionLine[]): boolean {
  const key = (lines: readonly CommissionLine[]) =>
    lines
      .map((line) => `${lineKey(line)}=${roundCents(line.percentage)}`)
      .sort()
      .join("|");
  return key(before) !== key(after);
}
