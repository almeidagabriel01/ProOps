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
  const isLoginPage = pathname === "/login";

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <TenantProvider>
            <ProtectedRoute>
              {isLoginPage ? (
                <main className="min-h-screen flex flex-col">{children}</main>
              ) : (
                <div className="flex min-h-screen">
                  <Sidebar />
                  <div className="flex-1 flex flex-col ml-64">
                    <Header />
                    <main className="flex-1 mt-16 p-8 overflow-y-auto">
                      {children}
                    </main>
                  </div>
                </div>
              )}
            </ProtectedRoute>
          </TenantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
