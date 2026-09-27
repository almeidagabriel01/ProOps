import type { Metadata } from "next";
import { NicheLandingRoute } from "@/components/landing/niche/niche-landing-route";
import { buildNicheLandingMetadata } from "@/lib/landing/niche-landing-metadata";

export const metadata: Metadata = buildNicheLandingMetadata("automacao_residencial");

export default function AutomacaoResidencialPage() {
  return <NicheLandingRoute niche="automacao_residencial" />;
}
