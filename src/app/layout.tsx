"use client";

import { usePathname } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";
import { ToastContainer } from "react-toastify";
import { Header } from "@/components/layout/header";
import { BottomDock } from "@/components/layout/bottom-dock";
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
    pathname.startsWith("/subscription-blocked") ||
    pathname.startsWith("/share/"); // Public shared proposal pages

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
                      <div className="flex h-screen overflow-hidden bg-card">
                        <div className="flex-1 flex flex-col bg-background overflow-hidden">
                          <Header sidebarWidth={0} />
                          <SubscriptionGuard>
                            <main
                              id="main-content"
                              className="flex-1 p-8 pb-28 overflow-y-auto"
                            >
                              {children}
                            </main>
                          </SubscriptionGuard>
                        </div>
                        <BottomDock />
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
