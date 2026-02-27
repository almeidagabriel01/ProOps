const PT_BR_COLLATOR = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

export function normalizeSortText(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function compareDisplayText(a: string, b: string): number {
  const normalizedA = normalizeSortText(a);
  const normalizedB = normalizeSortText(b);

  const byNormalized = PT_BR_COLLATOR.compare(normalizedA, normalizedB);
  if (byNormalized !== 0) return byNormalized;

  const byTrimmed = PT_BR_COLLATOR.compare(a.trim(), b.trim());
  if (byTrimmed !== 0) return byTrimmed;

  return PT_BR_COLLATOR.compare(a, b);
}
