import type { Metadata } from "next";
import { NicheLandingRoute } from "@/components/landing/niche/niche-landing-route";
import { buildNicheLandingMetadata } from "@/lib/landing/niche-landing-metadata";

export const metadata: Metadata = buildNicheLandingMetadata("seguranca_eletronica");

export default function SegurancaEletronicaPage() {
  return <NicheLandingRoute niche="seguranca_eletronica" />;
}
