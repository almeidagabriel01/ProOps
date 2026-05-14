/**
 * One-shot script to generate all SEO/PWA icon assets for ProOps.
 *
 * Run: node scripts/generate-icons.mjs
 * (from apps/web/ directory)
 *
 * Sources: public/logo/logo2-transparent.png (1600x900 symbol, black on transparent)
 *          public/logo/logo-transparent.png  (1600x1600 wordmark, black on transparent)
 *
 * Outputs:
 *   src/app/icon.png              512x512  — App Router favicon (Next.js reads this)
 *   src/app/apple-icon.png        180x180  — iOS home screen
 *   src/app/opengraph-image.png  1200x630  — OG / Twitter card
 *   public/favicon.ico            multi-size (48/32/16) — legacy browser / Google fallback
 *   public/icons/icon-192.png     192x192  — manifest
 *   public/icons/icon-512.png     512x512  — manifest
 *   public/icons/icon-maskable-512.png  512x512 with 20% safe-zone — manifest maskable
 */

import sharp from "sharp";
import pngToIco from "png-to-ico";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, ".."); // apps/web/

const SYMBOL_SRC = join(ROOT, "public/logo/logo2-transparent.png");
const WORDMARK_SRC = join(ROOT, "public/logo/logo-transparent.png");

mkdirSync(join(ROOT, "public/icons"), { recursive: true });

/**
 * Extract a 900×900 square from the center of the 1600×900 symbol PNG,
 * flatten to white, resize with contain fit + white fill + padding.
 */
async function makeSquareIcon(size, paddingPct = 0.12) {
  const padding = Math.round(size * paddingPct);
  const inner = size - padding * 2;

  return sharp(SYMBOL_SRC)
    // crop 900×900 from center of 1600×900 canvas
    .extract({ left: 350, top: 0, width: 900, height: 900 })
    .flatten({ background: "#ffffff" })
    .resize(inner, inner, { fit: "contain", background: "#ffffff" })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: "#ffffff",
    })
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
 * Fit wordmark onto a 1200×630 white canvas (OG image).
 */
async function makeOgImage() {
  const W = 1200;
  const H = 630;
  // Logo max width = 800px, max height = 200px, centered
  const logoMaxW = 800;
  const logoMaxH = 200;

  const logoBuffer = await sharp(WORDMARK_SRC)
    .flatten({ background: "#ffffff" })
    .resize(logoMaxW, logoMaxH, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoW = logoMeta.width;
  const logoH = logoMeta.height;
  const left = Math.round((W - logoW) / 2);
  const top = Math.round((H - logoH) / 2);

  return sharp({
    create: { width: W, height: H, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();
}

async function main() {
  console.log("Generating ProOps icon assets...");

  const icon512 = await makeSquareIcon(512);
  const icon192 = await makeSquareIcon(192);
  const icon180 = await makeSquareIcon(180);
  const iconMaskable512 = await makeMaskableIcon(512);
  const ogImage = await makeOgImage();

  // App Router special files
  writeFileSync(join(ROOT, "src/app/icon.png"), icon512);
  console.log("  ✓ src/app/icon.png (512×512)");

  writeFileSync(join(ROOT, "src/app/apple-icon.png"), icon180);
  console.log("  ✓ src/app/apple-icon.png (180×180)");

  writeFileSync(join(ROOT, "src/app/opengraph-image.png"), ogImage);
  console.log("  ✓ src/app/opengraph-image.png (1200×630)");

  // Manifest icons
  writeFileSync(join(ROOT, "public/icons/icon-192.png"), icon192);
  console.log("  ✓ public/icons/icon-192.png (192×192)");

  writeFileSync(join(ROOT, "public/icons/icon-512.png"), icon512);
  console.log("  ✓ public/icons/icon-512.png (512×512)");

  writeFileSync(join(ROOT, "public/icons/icon-maskable-512.png"), iconMaskable512);
  console.log("  ✓ public/icons/icon-maskable-512.png (512×512 maskable)");

  // favicon.ico: multi-size from 48/32/16 buffers
  const ico48 = await makeSquareIcon(48, 0.08);
  const ico32 = await makeSquareIcon(32, 0.08);
  const ico16 = await makeSquareIcon(16, 0.06);

  const icoBuffer = await pngToIco([ico48, ico32, ico16]);
  writeFileSync(join(ROOT, "public/favicon.ico"), icoBuffer);
  console.log("  ✓ public/favicon.ico (48/32/16 multi-size)");

  console.log("\nDone. Open each file to verify logo is black on white background.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
