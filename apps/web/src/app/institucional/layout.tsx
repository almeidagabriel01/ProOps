import type { ReactNode } from "react";
import localFont from "next/font/local";

/**
 * Type for the company page, declared HERE and not in the root layout.
 *
 * next/font injects a `<link rel="preload">` on every route that carries the
 * CSS variable, and the root layout puts every variable on `<body>`. Declaring
 * these two there would make the ERP preload 87KB of fonts it never renders,
 * on every page, against a Lighthouse budget measured on slow-3G. A nested
 * layout scopes both the preload and the variable to this route.
 *
 * Both are subset to latin (U+0000-00FF), which covers Portuguese in full.
 */

// Bricolage Grotesque: the display voice. Requested weight-only on purpose —
// the three-axis file (opsz, wdth, wght) is 131KB against 41KB for this one,
// and the optical-size and width axes buy nothing at the sizes used here.
const bricolage = localFont({
  src: "../fonts/bricolage-grotesque-variable.woff2",
  variable: "--font-bricolage",
  display: "swap",
  weight: "200 800",
});

// Fraunces italic: the editorial accent, the counterpart to Playfair on the
// ERP landing. The WONK axis (deliberate irregularity) is kept because it is
// what gives the face its character and costs 200 bytes.
const fraunces = localFont({
  src: "../fonts/fraunces-italic-variable.woff2",
  variable: "--font-fraunces",
  display: "swap",
  weight: "100 900",
  style: "italic",
});

export default function InstitucionalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`${bricolage.variable} ${fraunces.variable}`}>
      {children}
    </div>
  );
}
