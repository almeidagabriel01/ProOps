import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
import { Providers } from "./providers";
import { MotionProvider } from "@/providers/motion-provider";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";
import { ErrorReporterInstaller } from "@/components/observability/error-reporter-installer";

// Fonts are self-hosted (latin subset, downloaded from Google Fonts) instead of
// fetched by next/font/google at build time. Google rotates the hashed file URLs
// within a same-numbered version, which 404s any build that restores a cache
// holding the previous URLs — that is what broke the production deploy of
// 2026-08-11. Self-hosting removes the build-time network dependency entirely
// and drops the runtime round-trip to fonts.gstatic.com.
//
// To refresh a file: fetch https://fonts.googleapis.com/css2?family=<Name>:wght@<range>
// with a modern browser User-Agent and download the woff2 whose unicode-range
// covers U+0000-00FF (latin).

const geistSans = localFont({
  src: "./fonts/geist-variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

const interPdf = localFont({
  src: "./fonts/inter-variable.woff2",
  variable: "--font-pdf-inter",
  display: "block",
  weight: "400 700",
});

// PDF-only fonts (Roboto/Lato): used exclusively by the PDF editor/generation,
// never on marketing or app shell pages. preload:false stops next/font from
// injecting a render-competing <link rel="preload"> on every page; the @font-face
// still loads on demand wherever the var is actually applied (PDF capture waits
// for document.fonts.ready, so generated PDFs are unaffected).
const robotoPdf = localFont({
  src: "./fonts/roboto-variable.woff2",
  variable: "--font-pdf-roboto",
  display: "block",
  preload: false,
  weight: "400 700",
});

// Lato has no variable version on Google Fonts — the two static cuts in use.
const latoPdf = localFont({
  src: [
    { path: "./fonts/lato-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/lato-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-pdf-lato",
  display: "block",
  preload: false,
});

const montserratPdf = localFont({
  src: "./fonts/montserrat-variable.woff2",
  variable: "--font-pdf-montserrat",
  display: "block",
  weight: "400 700",
});

const playfairPdf = localFont({
  src: "./fonts/playfair-display-variable.woff2",
  variable: "--font-pdf-playfair",
  display: "block",
  weight: "400 700",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://proops.com.br"
  ),
  title: {
    default: "ProOps - ERP para gestão de serviços",
    template: "%s | ProOps",
  },
  icons: {
    // Light/dark favicon pair switched by the `media` attribute on each <link>
    // (the same technique TOTVS uses; Chromium honors media on icon links).
    // Default (no media) = dark glyph, so Google Search shows the dark logo on
    // its white SERP circle. prefers-color-scheme:dark = white glyph, so dark
    // browser tabs show a white logo. Regenerate via scripts/generate-icons.mjs.
    icon: [
      { url: "/icons/icon-light-192.png", type: "image/png", sizes: "192x192" },
      {
        url: "/icons/icon-light-192.png",
        type: "image/png",
        sizes: "192x192",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icons/icon-dark-192.png",
        type: "image/png",
        sizes: "192x192",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    // No `shortcut: /favicon.ico` on purpose: a non-media favicon.ico link has
    // an exact 16px size and would win for the tab icon, defeating the media
    // switching above. favicon.ico still exists in public/ for Google's direct
    // /favicon.ico probe (Google fetches it even when it isn't linked).
    apple: "/apple-icon.png",
  },
  description:
    "ProOps é o ERP completo para empresas de serviço: propostas, CRM, financeiro, agenda e WhatsApp integrados em uma plataforma online com editor de PDF profissional.",
  applicationName: "ProOps",
  keywords: [
    "ERP automação residencial",
    "ERP cortinas",
    "sistema gestão de serviços",
    "propostas comerciais",
    "CRM kanban",
    "ERP brasileiro",
    "gestão financeira PMEs",
    "editor PDF propostas",
  ],
  authors: [{ name: "ProOps" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    url: "/",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "ProOps - ERP para gestão de serviços",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image.png"],
  },
  alternates: { canonical: "/" },
  verification: {
    google: process.env.NEXT_PUBLIC_SEARCH_CONSOLE_VERIFICATION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${interPdf.variable} ${robotoPdf.variable} ${latoPdf.variable} ${montserratPdf.variable} ${playfairPdf.variable} antialiased`}
      >
        {/*
          Browser back/forward recovery — see public/bfcache-recovery.js for the
          full rationale. Loaded as a same-origin external script (beforeInteractive)
          so it satisfies CSP `script-src 'self'` WITHOUT depending on
          'unsafe-inline', and attaches its pageshow listener before hydration so
          it survives a back/forward restore (where the React tree never re-mounts).
        */}
        <Script src="/bfcache-recovery.js" strategy="beforeInteractive" />
        {/* Reveals the consent banner at first paint (before hydration) so it is
            never the late-painting LCP element — see cookie-consent-init.js. */}
        <Script src="/cookie-consent-init.js" strategy="beforeInteractive" />
        <ErrorReporterInstaller />
        <MotionProvider>
          <Providers>{children}</Providers>
          <CookieConsentBanner />
        </MotionProvider>
        <Analytics />
        <SpeedInsights />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
