import type React from "react";

export interface NicheLandingConfig {
  slug: "automacao_residencial" | "cortinas";
  hero: {
    eyebrow: string;
    title: string;
    titleHighlight: string;
    subtitle: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
  };
  features: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }[];
  modulesSection: { title: string; subtitle: string };
  modules: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    bullets: string[];
  }[];
  faq: { question: string; answer: string }[];
  cta: {
    title: string;
    subtitle: string;
    crossLink: { label: string; href: string };
  };
  seo: {
    metadataTitle: string;
    metadataDescription: string;
    breadcrumb: string;
  };
}
