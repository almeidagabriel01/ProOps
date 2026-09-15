import { INSTAGRAM_HREF } from "@/components/landing/_shared/whatsapp";
import { APEX_URL, SITE_URLS } from "@/lib/site/surfaces";
import { APP_NAME } from "@/lib/site/app-brand";

/**
 * Structured data for the company page.
 *
 * Not the shared `OrganizationJsonLd`: that one anchors at
 * `NEXT_PUBLIC_SITE_URL`, a build-time value that knows nothing about which
 * host is being served, and it declares an empty `sameAs`. This page IS the
 * company's home, so it is the one place where the Organization node belongs,
 * with the apex as its URL on both sides of the cutover.
 *
 * `owns` is the part that earns its keep: it is what tells Google that the ERP
 * and the app are two products of one company rather than three unrelated
 * domains that happen to share a name. Without it, splitting one domain into
 * three reads to a crawler as losing a site and gaining two strangers.
 *
 * No `aggregateRating`, no employee count, no founding date: everything here is
 * verifiable today. The numbers on the page itself are still placeholders, and
 * a placeholder that reaches structured data stops being a placeholder and
 * becomes a claim.
 */
export function InstitucionalJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ProOps",
    url: `${APEX_URL}/`,
    logo: `${APEX_URL}/icons/icon-512.png`,
    description:
      "A ProOps constrói software de gestão para quem vende projeto: um ERP para a operação da empresa e um aplicativo para a vida financeira de cada pessoa.",
    sameAs: [INSTAGRAM_HREF],
    owns: [
      {
        "@type": "SoftwareApplication",
        name: "ProOps ERP",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${SITE_URLS.erp}/`,
      },
      {
        "@type": "MobileApplication",
        name: APP_NAME,
        applicationCategory: "FinanceApplication",
        operatingSystem: "iOS, Android",
        url: `${SITE_URLS.app}/`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
