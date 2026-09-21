import localFont from "next/font/local";

/**
 * Type for the company site, declared ONCE and shared by its two layouts.
 *
 * next/font injects a `<link rel="preload">` on every route that carries the CSS
 * variable, and the root layout puts every variable on `<body>`. Declaring these
 * there would make the ERP preload 87KB of fonts it never renders, on every page,
 * against a Lighthouse budget measured on slow-3G. A nested layout scopes both
 * the preload and the variable to this surface.
 *
 * It lives in a module of its own because the surface now has two layouts, the
 * root experience at `/institucional` and the route group behind the company's
 * apex-level pages. Two `localFont` calls for the same file would work, but the
 * two would drift the moment one of them is tuned.
 *
 * Both faces are subset to latin (U+0000-00FF), which covers Portuguese in full.
 */

// Bricolage Grotesque: the display voice. Requested weight-only on purpose — the
// three-axis file (opsz, wdth, wght) is 131KB against 41KB for this one, and the
// optical-size and width axes buy nothing at the sizes used here.
const bricolage = localFont({
  src: "./bricolage-grotesque-variable.woff2",
  variable: "--font-bricolage",
  display: "swap",
  weight: "200 800",
});

// Fraunces italic: the editorial accent, the counterpart to Playfair on the ERP
// landing. The WONK axis (deliberate irregularity) is kept because it is what
// gives the face its character and costs 200 bytes.
const fraunces = localFont({
  src: "./fraunces-italic-variable.woff2",
  variable: "--font-fraunces",
  display: "swap",
  weight: "100 900",
  style: "italic",
});

/** Put on the outermost element of the surface. */
export const FONTES_INSTITUCIONAL = `${bricolage.variable} ${fraunces.variable}`;
