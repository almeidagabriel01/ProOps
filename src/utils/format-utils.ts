/**
 * Formatting utilities for consistent display across the application
 * Following DRY principle - centralizing all format functions
 */

/**
 * Format a number as Brazilian currency (BRL)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Format a date string to Brazilian locale (timezone-safe)
 * Parses dates manually to avoid timezone conversion issues
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "-";
  try {
    // Extract date part if ISO format
    const datePart = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;

    // Parse manually to avoid timezone issues
    const parts = datePart.split("-").map(Number);
    if (parts.length !== 3) {
      return new Date(dateString).toLocaleDateString("pt-BR");
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString("pt-BR");
  } catch {
    return dateString;
  }
}

/**
 * Format a date string to ISO date (YYYY-MM-DD) for input fields
 */
export function formatDateForInput(dateString?: string): string {
  if (!dateString) return "";
  return dateString.split("T")[0];
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Parse a currency string back to number
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}
