import type { Metadata } from "next";
import { NicheLandingRoute } from "@/components/landing/niche/niche-landing-route";
import { buildNicheLandingMetadata } from "@/lib/landing/niche-landing-metadata";

export const metadata: Metadata = buildNicheLandingMetadata("moveis_planejados");

export default function MoveisPlanejadosPage() {
  return <NicheLandingRoute niche="moveis_planejados" />;
}
