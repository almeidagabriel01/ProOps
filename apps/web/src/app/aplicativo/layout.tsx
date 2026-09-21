import type { ReactNode } from "react";
import localFont from "next/font/local";

/**
 * Type for the mobile app landing, declared HERE and not in the root layout,
 * for the same reason as the company page: next/font preloads per route that
 * carries the variable, and the root layout would push these onto the ERP.
 *
 * These are the two families the app itself uses, from
 * `@expo-google-fonts/hanken-grotesk` and `jetbrains-mono`. The page and the
 * product screenshots read as the same thing because they are set in the same
 * type, not because the page imitates it.
 */

const hanken = localFont({
  src: "../fonts/hanken-grotesk-variable.woff2",
  variable: "--font-hanken",
  display: "swap",
  weight: "100 900",
});

// The app sets every number in mono: money, percentages, dates, badges.
const jetbrainsMono = localFont({
  src: "../fonts/jetbrains-mono-variable.woff2",
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: "100 800",
});

export default function AplicativoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`app-theme ${hanken.variable} ${jetbrainsMono.variable}`}>
      {children}
    </div>
  );
}
