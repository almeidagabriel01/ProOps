import type { Metadata } from "next";
import { SettingsNav } from "./_components/settings-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Gerencie sua conta, segurança e preferências.
        </p>
      </div>
      <div className="border-t border-border/60 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
        <SettingsNav />
        <div className="min-w-0 lg:-mt-8">{children}</div>
      </div>
    </div>
  );
}
