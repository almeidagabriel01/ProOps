/**
 * Normalizes a string by removing accents and converting to lowercase.
 * Useful for accent-insensitive search.
 * @param str The string to normalize
 * @returns The normalized string
 */
export function normalize(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
