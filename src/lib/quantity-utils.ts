export function normalizeItemQuantity(
  value: number,
  allowDecimal: boolean,
): number {
  if (!Number.isFinite(value)) return 0;

  const normalized = Math.max(0, value);
  return allowDecimal
    ? Number(normalized.toFixed(2))
    : Math.trunc(normalized);
}

export function formatItemQuantity(
  value: number,
  allowDecimal: boolean,
): string {
  const normalized = normalizeItemQuantity(value, allowDecimal);

  return allowDecimal
    ? normalized.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : normalized.toString();
}

export function parseItemQuantityInput(
  rawValue: string,
  allowDecimal: boolean,
): number | null {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return 0;
  }

  const normalizedValue = allowDecimal
    ? trimmedValue.replace(/\s+/g, "").replace(",", ".").replace(/[^0-9.]/g, "")
    : trimmedValue.replace(/\D/g, "");

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = allowDecimal
    ? Number.parseFloat(normalizedValue)
    : Number.parseInt(normalizedValue, 10);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return normalizeItemQuantity(parsedValue, allowDecimal);
}
