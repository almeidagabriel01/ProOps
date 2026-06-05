/**
 * One-shot script to generate all SEO/PWA icon assets for ProOps.
 *
 * Run: node scripts/generate-icons.mjs   (from apps/web/)
 *  or: node apps/web/scripts/generate-icons.mjs   (from repo root)
 *
 * Strategy (same as TOTVS): a light/dark favicon PAIR declared in layout.tsx
 * with `media` queries on the <link rel="icon"> tags (Chromium honors the media
 * attribute on link tags, unlike prefers-color-scheme INSIDE an SVG):
 *   - default (no media) + light theme -> DARK glyph  -> Google SERP + light tabs
 *   - prefers-color-scheme: dark        -> WHITE glyph -> dark browser tabs
 * There is intentionally NO app/icon.svg / app/icon.png: a no-media SVG file
 * convention would be preferred by browsers and defeat the media switching.
 *
 * Sources: public/logo/logo2-transparent.png (1600x900 symbol, black on transparent)
 *          public/logo/logo-transparent.png  (1600x1600 wordmark, black on transparent)
 *          public/logo/logo2-cropped.svg     (vector symbol, recolored per icon)
 *
 * Outputs:
 *   public/icons/icon-light-192.png    192x192  - DARK glyph, transparent (default + light + Google)
 *   public/icons/icon-dark-192.png     192x192  - WHITE glyph, transparent (dark browser tab)
 *   public/favicon.ico                 48/32/16 - DARK glyph, transparent (Google root probe / fallback)
 *   src/app/apple-icon.png             180x180  - iOS home screen, WHITE bg (iOS needs opaque)
 *   src/app/opengraph-image.png       1200x630  - OG / Twitter card, white bg
 *   public/icons/icon-192.png          192x192  - manifest, white bg
 *   public/icons/icon-512.png          512x512  - manifest + JSON-LD Organization.logo, white bg
 *   public/icons/icon-maskable-512.png 512x512  - manifest maskable (20% safe-zone), white bg
 */

import sharp from "sharp";
import pngToIco from "png-to-ico";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, writeFileSync, readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, ".."); // apps/web/

const SYMBOL_SRC = join(ROOT, "public/logo/logo2-transparent.png");
const WORDMARK_SRC = join(ROOT, "public/logo/logo-transparent.png");
const SVG_LOGO_SRC = join(ROOT, "public/logo/logo2-cropped.svg");

const GLYPH_FILL = "#0a0a0a"; // dark logo (default + light theme + Google's light circle)
const GLYPH_FILL_DARK = "#ffffff"; // light logo for dark-themed browsers (prefers-color-scheme: dark)
const BG = "#ffffff"; // solid white background (for opaque assets only)
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

mkdirSync(join(ROOT, "public/icons"), { recursive: true });

/**
 * Extract a 900x900 square from the center of the 1600x900 symbol PNG,
 * flatten to white, resize with contain fit + white fill + padding.
 */
async function makeSquareIcon(size, paddingPct = 0.12, background = BG) {
  const padding = Math.round(size * paddingPct);
  const inner = size - padding * 2;
  const bg = background === "transparent" ? TRANSPARENT : background;

  // Crop 900x900 from center, then trim the transparent border so the symbol
  // fills the frame consistently (the source PNG has whitespace baked in).
  // extract + trim must be separate pipelines (chaining them in one errors).
  const cropped = await sharp(SYMBOL_SRC)
    .extract({ left: 350, top: 0, width: 900, height: 900 })
    .png()
    .toBuffer();
  const trimmed = await sharp(cropped).trim().png().toBuffer();

  // The source symbol is already black on transparent. Flatten only for
  // opaque assets; leave transparent ones with their alpha channel intact.
  let pipe = sharp(trimmed);
  if (background !== "transparent") pipe = pipe.flatten({ background });
  return pipe
    .resize(inner, inner, { fit: "contain", background: bg })
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: bg })
    .png()
    .toBuffer();
}

/**
 * Same as makeSquareIcon but with 20% padding for PWA maskable safe zone.
 */
async function makeMaskableIcon(size) {
  return makeSquareIcon(size, 0.2);
}

/**
 * Build the ADAPTIVE SVG favicon (transparent background):
 *   - default / light theme / Google's light SERP circle -> dark glyph (visible)
 *   - prefers-color-scheme: dark (dark browser tab) -> white glyph (contrast)
 * The dark default is deliberate: if a renderer (e.g. Google) ignores the media
 * query, it falls back to the dark glyph and stays visible on the light circle.
 * The <g> keeps a dark presentation fill so even renderers that ignore <style>
 * render dark.
 */
/**
 * Build an SVG of the logo glyph with a given fill on a TRANSPARENT background,
 * square viewBox centered on the symbol.
 */
function logoSvg(fill) {
  const src = readFileSync(SVG_LOGO_SRC, "utf8");
  const g = src.match(/<g[\s\S]*?<\/g>/);
  if (!g) throw new Error("Could not find <g> in logo2-cropped.svg");
  const glyph = g[0].replace(/fill="#ffffff"/i, `fill="${fill}"`);
  // Glyph content lives at x 540-950 / y 250-680 (410x430); a square viewBox
  // centered on (745, 465). Side 440 leaves only a thin margin (~3% horizontal,
  // ~1% vertical) so the glyph nearly fills the favicon. The glyph is 430 tall,
  // so going below ~440 would start clipping it top/bottom.
  const x = 525;
  const y = 245;
  const size = 440;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${x} ${y} ${size} ${size}">
${glyph}
</svg>
`;
}

/** Render the logo glyph (given fill) to a transparent PNG buffer of size px. */
async function logoPng(fill, size) {
  return sharp(Buffer.from(logoSvg(fill)))
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
}

/**
 * Fit wordmark onto a 1200x630 white canvas (OG image).
 */
async function makeOgImage() {
  const W = 1200;
  const H = 630;
  const logoMaxW = 800;
  const logoMaxH = 200;

  const logoBuffer = await sharp(WORDMARK_SRC)
    .flatten({ background: BG })
    .resize(logoMaxW, logoMaxH, { fit: "contain", background: BG })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoW = logoMeta.width;
  const logoH = logoMeta.height;
  const left = Math.round((W - logoW) / 2);
  const top = Math.round((H - logoH) / 2);

  return sharp({
    create: { width: W, height: H, channels: 3, background: BG },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();
}

async function main() {
  console.log("Generating ProOps icon assets (TOTVS-style light/dark favicon pair)...");

  const icon512 = await makeSquareIcon(512); // opaque white (manifest + JSON-LD)
  const icon192 = await makeSquareIcon(192); // opaque white (manifest)
  const icon180 = await makeSquareIcon(180); // opaque white (iOS needs opaque)
  const iconMaskable512 = await makeMaskableIcon(512); // opaque white (PWA maskable)
  const ogImage = await makeOgImage();

  // Favicon pair, declared with media queries in layout.tsx (like TOTVS).
  // Both transparent; only the glyph color differs.
  //   icon-light: DARK glyph  -> default (no media) + light theme + Google SERP
  //   icon-dark:  WHITE glyph -> prefers-color-scheme: dark (dark browser tab)
  writeFileSync(join(ROOT, "public/icons/icon-light-192.png"), await logoPng(GLYPH_FILL, 192));
  console.log("  [ok] public/icons/icon-light-192.png (192x192, dark glyph, transparent)");

  writeFileSync(join(ROOT, "public/icons/icon-dark-192.png"), await logoPng(GLYPH_FILL_DARK, 192));
  console.log("  [ok] public/icons/icon-dark-192.png (192x192, white glyph, transparent)");

  // iOS renders transparency as black on the home screen, so apple-icon stays opaque.
  writeFileSync(join(ROOT, "src/app/apple-icon.png"), icon180);
  console.log("  [ok] src/app/apple-icon.png (180x180, white bg)");

  writeFileSync(join(ROOT, "src/app/opengraph-image.png"), ogImage);
  console.log("  [ok] src/app/opengraph-image.png (1200x630)");

  // Manifest icons (opaque white - PWA install + JSON-LD Organization.logo)
  writeFileSync(join(ROOT, "public/icons/icon-192.png"), icon192);
  console.log("  [ok] public/icons/icon-192.png (192x192)");

  writeFileSync(join(ROOT, "public/icons/icon-512.png"), icon512);
  console.log("  [ok] public/icons/icon-512.png (512x512)");

  writeFileSync(join(ROOT, "public/icons/icon-maskable-512.png"), iconMaskable512);
  console.log("  [ok] public/icons/icon-maskable-512.png (512x512 maskable)");

  // favicon.ico: Google root probe + non-media fallback -> DARK glyph (visible
  // on Google's white circle), transparent, multi-size 48/32/16.
  const icoBuffer = await pngToIco([
    await logoPng(GLYPH_FILL, 48),
    await logoPng(GLYPH_FILL, 32),
    await logoPng(GLYPH_FILL, 16),
  ]);
  writeFileSync(join(ROOT, "public/favicon.ico"), icoBuffer);
  console.log("  [ok] public/favicon.ico (48/32/16, dark glyph, transparent)");

  console.log("\nDone. Google gets the dark glyph; dark browser tabs get the white glyph.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
