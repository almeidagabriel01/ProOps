/**
 * Color manipulation utilities for consistent UI theming
 * Following DRY principle - centralizing all color functions
 */

/**
 * Calculate contrast text color (black or white) based on background
 * Uses luminance calculation for accessibility
 */
export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}

// ─── Tonal palette / adaptive contrast (Material Design 3 approach) ──────────

/** Convert hex to HSL (h: 0-360, s: 0-100, l: 0-100) */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substr(0, 2), 16) / 255;
  const g = parseInt(clean.substr(2, 2), 16) / 255;
  const b = parseInt(clean.substr(4, 2), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Convert HSL back to hex */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** WCAG relative luminance of a hex color */
export function getRelativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = toLinear(parseInt(clean.substr(0, 2), 16) / 255);
  const g = toLinear(parseInt(clean.substr(2, 2), 16) / 255);
  const b = toLinear(parseInt(clean.substr(4, 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors */
export function getContrastRatio(fg: string, bg: string): number {
  const l1 = getRelativeLuminance(fg);
  const l2 = getRelativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Return the foreground color (white or dark-gray) that best contrasts
 * against the given background hex. Uses WCAG relative luminance.
 */
export function computePrimaryForeground(bgHex: string): string {
  return getRelativeLuminance(bgHex) > 0.179 ? "#1f2937" : "#ffffff";
}

// Dark mode background approximation: oklch(0.145 0 0) ≈ #1c1c1c
const DARK_BG = "#1c1c1c";
// Light mode background approximation: oklch(0.96 0.005 265) ≈ #f4f5f8
const LIGHT_BG = "#f4f5f8";

/**
 * Derive a dark-mode-safe variant of a brand color.
 * Preserves hue + saturation exactly; only raises lightness until
 * contrast ≥ 4.5:1 against the dark background (~#1c1c1c).
 * Black stays black-family (becomes a light gray), navy stays navy, etc.
 */
export function ensureDarkModeContrast(hex: string): string {
  if (getContrastRatio(hex, DARK_BG) >= 4.5) return hex;
  const { h, s, l } = hexToHsl(hex);
  let current = l;
  let candidate = hslToHex(h, s, current);
  for (let i = 0; i < 80; i++) {
    if (getContrastRatio(candidate, DARK_BG) >= 4.5) break;
    current = Math.min(100, current + 1);
    candidate = hslToHex(h, s, current);
  }
  return candidate;
}

/**
 * Derive a light-mode-safe variant of a brand color.
 * Preserves hue + saturation; lowers lightness until contrast ≥ 4.5:1
 * against the light background. Handles near-white brand colors.
 */
export function ensureLightModeContrast(hex: string): string {
  if (getContrastRatio(hex, LIGHT_BG) >= 4.5) return hex;
  const { h, s, l } = hexToHsl(hex);
  let current = l;
  let candidate = hslToHex(h, s, current);
  for (let i = 0; i < 60; i++) {
    if (getContrastRatio(candidate, LIGHT_BG) >= 4.5) break;
    current = Math.max(0, current - 1.5);
    candidate = hslToHex(h, s, current);
  }
  return candidate;
}

/**
 * Adjust color brightness by percentage
 * Positive percent = lighter, negative = darker
 */
export function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Lighten a hex color by percentage (0-100)
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, (num >> 16) + amt);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const b = Math.min(255, (num & 0x0000ff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Darken a hex color by percentage (0-100)
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, (num >> 16) - amt);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const b = Math.max(0, (num & 0x0000ff) - amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Convert hex to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00ff;
  const b = num & 0x0000ff;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Check if a color is valid hex
 */
export function isValidHex(hex: string): boolean {
  return /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}
