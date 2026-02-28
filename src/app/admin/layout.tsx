"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminSkeleton } from "./_components/admin-skeleton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only superadmins can access this layout's routes
    if (!isLoading && (!user || user.role !== "superadmin")) {
      router.push("/403");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "superadmin") {
    return <AdminSkeleton />;
  }

  return <>{children}</>;
}
