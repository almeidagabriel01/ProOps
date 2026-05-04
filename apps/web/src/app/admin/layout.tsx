import type { Metadata } from "next";
import { AdminGuard } from "./_components/admin-guard";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminGuard>{children}</AdminGuard>;
}
