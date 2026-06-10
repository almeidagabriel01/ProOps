import type { Metadata } from "next";
import { SettingsChrome } from "./_components/settings-chrome";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SettingsChrome>{children}</SettingsChrome>;
}
