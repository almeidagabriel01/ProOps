"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import {
  Sidebar,
  COLLAPSED_WIDTH,
  EXPANDED_WIDTH,
} from "@/components/layout/sidebar";
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

  // Pages that need auth provider but no sidebar/header (login, subscribe, checkout-success)
  const isAuthOnlyPage = pathname === "/login" || pathname.startsWith("/subscribe") || pathname.startsWith("/checkout-success");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

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
              <ProtectedRoute>
                {isAuthOnlyPage ? (
                  <main className="min-h-screen flex flex-col">{children}</main>
                ) : (
                  <div className="flex h-screen overflow-hidden bg-card">
                    <Sidebar onExpandChange={setSidebarExpanded} />
                    <div
                      className="flex-1 flex flex-col transition-all duration-300 ease-in-out bg-background rounded-l-[2rem] my-1 mr-1"
                      style={{
                        marginLeft: sidebarExpanded
                          ? EXPANDED_WIDTH
                          : COLLAPSED_WIDTH,
                      }}
                    >
                      <Header
                        sidebarWidth={
                          sidebarExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH
                        }
                      />
                      <main className="flex-1 mt-16 p-8 overflow-y-auto">
                        {children}
                      </main>
                    </div>
                  </div>
                )}
              </ProtectedRoute>
            </TenantProvider>
          </AuthProvider>
        )}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </body>
    </html>
  );
}