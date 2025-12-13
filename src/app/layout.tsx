"use client";

import { usePathname } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TenantProvider } from "@/providers/tenant-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";

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

  // Landing page - completely isolated from ERP (no providers)
  const isLandingPage = pathname === "/";

  // Login page - needs auth provider but no sidebar
  const isLoginPage = pathname === "/login";

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {isLandingPage ? (
          // Landing page - NO providers, completely isolated
          <main className="min-h-screen">{children}</main>
        ) : (
          // All other pages - wrapped with providers
          <AuthProvider>
            <TenantProvider>
              {isLoginPage ? (
                // Login page - no sidebar, no protected route
                <main className="min-h-screen flex flex-col bg-background text-foreground">
                  {children}
                </main>
              ) : (
                // Protected ERP pages - full layout with sidebar/header
                <ProtectedRoute>
                  <div className="flex min-h-screen bg-background text-foreground">
                    <Sidebar />
                    <div className="flex-1 flex flex-col ml-64">
                      <Header />
                      <main className="flex-1 mt-16 p-8 overflow-y-auto">
                        {children}
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              )}
            </TenantProvider>
          </AuthProvider>
        )}
      </body>
    </html>
  );
}
