import type { Metadata } from "next";
import { SettingsTabs } from "./_components/settings-tabs";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full">
      <SettingsTabs />
      {children}
    </div>
  );
}
