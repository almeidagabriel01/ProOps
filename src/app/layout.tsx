"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";
import { ToastContainer } from "react-toastify";
import {
  Sidebar,
  COLLAPSED_WIDTH,
  EXPANDED_WIDTH,
} from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TenantProvider } from "@/providers/tenant-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { PermissionsProvider } from "@/providers/permissions-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SubscriptionGuard } from "@/components/shared/subscription-guard";
import { usePageTitle } from "@/hooks/usePageTitle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    pathname.startsWith("/subscribe") ||
    pathname.startsWith("/checkout-success") ||
    pathname.startsWith("/auth") ||
    pathname === "/403" ||
    pathname === "/subscription-blocked" ||
    pathname.startsWith("/share/"); // Public shared proposal pages
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          {isLandingPage ? (
            <main className="min-h-screen">{children}</main>
          ) : pathname.startsWith("/share/") ? (
            // Public shared proposal pages - no authentication required
            <main className="min-h-screen">{children}</main>
          ) : (
            <AuthProvider>
              <PermissionsProvider>
                <TenantProvider>
                  <ProtectedRoute>
                    {isAuthOnlyPage ? (
                      <main className="min-h-screen flex flex-col">
                        {children}
                      </main>
                    ) : (
                      <div className="flex h-screen overflow-hidden bg-sidebar">
                        <Sidebar onExpandChange={setSidebarExpanded} />
                        <div
                          className="flex-1 flex flex-col bg-background rounded-l-[2rem] mr-1 ml-1 overflow-hidden transition-[margin-left] duration-300 ease-out"
                          style={{
                            marginLeft: sidebarExpanded
                              ? EXPANDED_WIDTH
                              : COLLAPSED_WIDTH,
                          }}
                        >
                          <Header sidebarWidth={0} />
                          <SubscriptionGuard>
                            <main
                              id="main-content"
                              className="flex-1 p-8 overflow-y-auto"
                            >
                              {children}
                            </main>
                          </SubscriptionGuard>
                        </div>
                      </div>
                    )}
                  </ProtectedRoute>
                </TenantProvider>
              </PermissionsProvider>
            </AuthProvider>
          )}
          <ToastContainer
            position="top-center"
            autoClose={4000}
            hideProgressBar
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss={false}
            draggable={false}
            pauseOnHover
            theme="dark"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
