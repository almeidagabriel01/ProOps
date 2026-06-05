/**
 * One-shot script to generate all SEO/PWA icon assets for ProOps.
 *
 * Run: node scripts/generate-icons.mjs   (from apps/web/)
 *  or: node apps/web/scripts/generate-icons.mjs   (from repo root)
 *
 * Goal: a DARK logo so it's visible. The browser-tab + Google favicon are
 * TRANSPARENT (Google draws a light circle behind the favicon, so a dark logo
 * stands out). Assets that technically require an opaque background (iOS,
 * PWA/manifest, Knowledge Panel) keep a solid white background.
 * The original bug was a WHITE logo, which vanished on Google's white circle.
 *
 * Sources: public/logo/logo2-transparent.png (1600x900 symbol, black on transparent)
 *          public/logo/logo-transparent.png  (1600x1600 wordmark, black on transparent)
 *          public/logo/logo2-cropped.svg     (vector symbol, used for icon.svg)
 *
 * Outputs:
 *   src/app/icon.svg              vector   - App Router favicon (PREFERRED), TRANSPARENT + dark logo
 *   src/app/icon.png              512x512  - App Router favicon fallback, TRANSPARENT + dark logo
 *   public/favicon.ico            48/32/16 - legacy browser / Google root probe, TRANSPARENT + dark logo
 *   src/app/apple-icon.png        180x180  - iOS home screen, WHITE bg (iOS needs opaque)
 *   src/app/opengraph-image.png  1200x630  - OG / Twitter card, white bg
 *   public/icons/icon-192.png          192x192  - manifest, white bg
 *   public/icons/icon-google.png       192x192  - extra Google hint, white bg
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

const GLYPH_FILL = "#0a0a0a"; // dark logo color (easy to swap, e.g. brand color)
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
 * Build the SVG favicon from the vector logo: TRANSPARENT background + dark
 * glyph, square viewBox centered on the symbol. The original icon.svg used a
 * white fill on a transparent background and vanished on Google's white circle;
 * a dark glyph stays visible there while keeping the browser tab transparent.
 */
function makeSvg() {
  const src = readFileSync(SVG_LOGO_SRC, "utf8");
  const g = src.match(/<g[\s\S]*?<\/g>/);
  if (!g) throw new Error("Could not find <g> in logo2-cropped.svg");
  const glyph = g[0].replace(/fill="#ffffff"/i, `fill="${GLYPH_FILL}"`);
  // Glyph content lives at x 540-950 / y 250-680; a square viewBox centered
  // on (745, 465) with side 600 gives ~16% padding on each side.
  const x = 445;
  const y = 165;
  const size = 600;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${x} ${y} ${size} ${size}">
${glyph}
</svg>
`;
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
  console.log("Generating ProOps icon assets (dark logo; tab/Google transparent)...");

  const icon512 = await makeSquareIcon(512); // opaque white (manifest + JSON-LD)
  const icon192 = await makeSquareIcon(192); // opaque white (manifest + Google hint)
  const icon180 = await makeSquareIcon(180); // opaque white (iOS needs opaque)
  const iconMaskable512 = await makeMaskableIcon(512); // opaque white (PWA maskable)
  const ogImage = await makeOgImage();

  // Browser tab + Google favicon: TRANSPARENT + dark logo (Google draws a
  // light circle behind it, so the dark logo stands out).
  writeFileSync(join(ROOT, "src/app/icon.svg"), makeSvg());
  console.log("  [ok] src/app/icon.svg (vector, transparent + dark logo)");

  writeFileSync(join(ROOT, "src/app/icon.png"), await makeSquareIcon(512, 0.12, "transparent"));
  console.log("  [ok] src/app/icon.png (512x512, transparent + dark logo)");

  // iOS renders transparency as black on the home screen, so apple-icon stays opaque.
  writeFileSync(join(ROOT, "src/app/apple-icon.png"), icon180);
  console.log("  [ok] src/app/apple-icon.png (180x180, white bg)");

  writeFileSync(join(ROOT, "src/app/opengraph-image.png"), ogImage);
  console.log("  [ok] src/app/opengraph-image.png (1200x630)");

  // Manifest icons
  writeFileSync(join(ROOT, "public/icons/icon-192.png"), icon192);
  console.log("  [ok] public/icons/icon-192.png (192x192)");

  // icon-google.png: same as icon-192 (white background + dark logo).
  // Referenced explicitly in layout.tsx metadata.icons.
  writeFileSync(join(ROOT, "public/icons/icon-google.png"), icon192);
  console.log("  [ok] public/icons/icon-google.png (192x192, white bg - Google Search)");

  writeFileSync(join(ROOT, "public/icons/icon-512.png"), icon512);
  console.log("  [ok] public/icons/icon-512.png (512x512)");

  writeFileSync(join(ROOT, "public/icons/icon-maskable-512.png"), iconMaskable512);
  console.log("  [ok] public/icons/icon-maskable-512.png (512x512 maskable)");

  // favicon.ico: multi-size from 48/32/16 buffers, TRANSPARENT + dark logo
  const ico48 = await makeSquareIcon(48, 0.08, "transparent");
  const ico32 = await makeSquareIcon(32, 0.08, "transparent");
  const ico16 = await makeSquareIcon(16, 0.06, "transparent");

  const icoBuffer = await pngToIco([ico48, ico32, ico16]);
  writeFileSync(join(ROOT, "public/favicon.ico"), icoBuffer);
  console.log("  [ok] public/favicon.ico (48/32/16 multi-size, transparent)");

  console.log("\nDone. Dark logo; tab/Google favicons transparent, others opaque white.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
