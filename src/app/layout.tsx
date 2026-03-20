"use client";

import { usePathname } from "next/navigation";
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
import { ToastProvider } from "@/components/shared/toast-provider";
import { TenantProvider } from "@/providers/tenant-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { PermissionsProvider } from "@/providers/permissions-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { usePageTitle } from "@/hooks/usePageTitle";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  usePageTitle();

  const isLandingPage = pathname === "/";

  const isAuthOnlyPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/email-verification-pending") ||
    pathname.startsWith("/subscribe") ||
    pathname.startsWith("/checkout-success") ||
    pathname.startsWith("/auth") ||
    pathname === "/403" ||
    pathname.startsWith("/subscription-blocked") ||
    pathname.startsWith("/share/"); // Public shared proposal pages

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>ProOps - Sistema ERP para gestão de serviços</title>
        <meta
          name="description"
          content="O ProOps é um sistema ERP para gestão de serviços que permite gerenciar clientes, ordens de serviço, relatórios e operações diárias em uma plataforma online."
        />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="shortcut icon" href="/icon.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${interPdf.variable} ${robotoPdf.variable} ${latoPdf.variable} ${montserratPdf.variable} ${playfairPdf.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            {isLandingPage ? (
              <main className="min-h-screen">{children}</main>
            ) : pathname.startsWith("/share/") ? (
              // Public shared proposal pages - no authentication required
              <main className="min-h-screen">{children}</main>
            ) : isAuthOnlyPage ? (
              <main className="min-h-screen flex flex-col">{children}</main>
            ) : (
              <PermissionsProvider>
                <TenantProvider>
                  <ProtectedRoute>{children}</ProtectedRoute>
                </TenantProvider>
              </PermissionsProvider>
            )}
          </AuthProvider>
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
