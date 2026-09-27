import type { Metadata } from "next";
import { NicheLandingRoute } from "@/components/landing/niche/niche-landing-route";
import { buildNicheLandingMetadata } from "@/lib/landing/niche-landing-metadata";

export const metadata: Metadata = buildNicheLandingMetadata("cortinas");

export default function DecoracaoPage() {
  return <NicheLandingRoute niche="cortinas" />;
}
