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
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    default: "ProOps — ERP para automação residencial e cortinas",
    template: "%s | ProOps",
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
        alt: "ProOps — ERP para gestão de serviços",
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
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
