const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proops.com.br";

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ProOps",
    url: BASE,
    logo: `${BASE}/icon.svg`,
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: "Portuguese",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface SoftwareApplicationJsonLdProps {
  niche?: "automacao_residencial" | "cortinas";
}

export function SoftwareApplicationJsonLd({
  niche,
}: SoftwareApplicationJsonLdProps = {}) {
  const nicheNames: Record<string, string> = {
    automacao_residencial: "automação residencial",
    cortinas: "cortinas e persianas",
  };

  const description = niche
    ? `ERP especializado para empresas de ${nicheNames[niche]}: propostas, CRM, financeiro, agenda e WhatsApp.`
    : "ERP completo para empresas de serviço: propostas, CRM, financeiro, agenda e WhatsApp integrados.";

  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ProOps",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: BASE,
    description,
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "50",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ProOps",
    url: BASE,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface BreadcrumbJsonLdProps {
  items: { name: string; url: string }[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${BASE}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
