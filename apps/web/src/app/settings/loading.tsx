"use client";

import { usePathname } from "next/navigation";
import { SettingsSectionSkeleton } from "@/components/layout/route-content-skeleton";

// Dentro do layout de configurações (título e menu lateral já estão na tela):
// só a seção carrega, com o desenho dela.
export default function Loading() {
  return <SettingsSectionSkeleton pathname={usePathname()} />;
}
