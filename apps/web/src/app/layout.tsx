import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Lato,
  Montserrat,
  Playfair_Display,
  Roboto,
} from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Providers } from "./providers";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const interPdf = Inter({
  variable: "--font-pdf-inter",
  subsets: ["latin"],
  display: "block",
  weight: ["400", "500", "600", "700"],
});

const robotoPdf = Roboto({
  variable: "--font-pdf-roboto",
  subsets: ["latin"],
  display: "block",
  weight: ["400", "500", "700"],
});

const latoPdf = Lato({
  variable: "--font-pdf-lato",
  subsets: ["latin"],
  display: "block",
  weight: ["400", "700"],
});

const montserratPdf = Montserrat({
  variable: "--font-pdf-montserrat",
  subsets: ["latin"],
  display: "block",
  weight: ["400", "500", "600", "700"],
});

const playfairPdf = Playfair_Display({
  variable: "--font-pdf-playfair",
  subsets: ["latin"],
  display: "block",
  weight: ["400", "500", "600", "700"],
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
          Browser back/forward recovery. A back/forward navigation restores a
          cached render WITHOUT re-executing JS (React never re-mounts), so the
          Framer Motion entrance animations never re-fire and the content stays
          at its server-rendered `initial` hidden state (opacity:0) — a blank
          white page that only a manual reload fixed. Since JS can't run to
          "replay" the animation on the restore, a reload is the only recovery.

          This must be a document-level listener attached at parse time and
          never removed, so it survives the restore (a React-effect listener
          does not — the tree isn't re-mounted). It reloads when the page was
          restored from bfcache (`event.persisted`) or the navigation is a
          history traversal (`PerformanceNavigationTiming.type === "back_forward"`).
          End-to-end regression coverage: tests/e2e/navigation/back-forward-recovery.spec.ts.
          No loop: after the reload the navigation type is "reload".
        */}
        <script
          id="bfcache-recovery"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){window.addEventListener('pageshow',function(e){try{var n=performance.getEntriesByType('navigation')[0];if(e.persisted||(n&&n.type==='back_forward')){window.location.reload();}}catch(_){}});})();",
          }}
        />
        <Providers>{children}</Providers>
        <CookieConsentBanner />
        <Analytics />
        <SpeedInsights />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
