import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS } from "@/lib/site/surfaces";

import { PLANOS } from "../_content/planos";

/**
 * Structured data for the app landing.
 *
 * `MobileApplication` and not the shared `SoftwareApplicationJsonLd`: that one
 * describes the ERP, declares `operatingSystem: "Web"` and anchors at whatever
 * `NEXT_PUBLIC_SITE_URL` holds. Reusing it here would tell Google this page is
 * the ERP under a different name.
 *
 * Two things are deliberately absent.
 *
 * **No `aggregateRating`.** The app has no reviews, and a rating in structured
 * data is a public claim: inventing one is a Google policy violation with a
 * manual penalty attached, and it is the single easiest way to lose rich
 * results for the whole domain.
 *
 * **No `downloadUrl` and no `installUrl`.** The app is not published on either
 * store. A structured-data field pointing at a page that is not a download is
 * worse than the field being missing. Both go in on the day the store links do,
 * next to the QR code slot documented in `aplicativo-planos.tsx`.
 *
 * The prices come from `_content/planos`, the same constant the pricing section
 * renders, so the page and the snippet cannot drift.
 */
export function AplicativoJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: APP_NAME,
    applicationCategory: "FinanceApplication",
    // Both, and in this order, because the page ships captures of both and the
    // gallery switches between them.
    operatingSystem: "iOS, Android",
    url: `${SITE_URLS.app}/`,
    inLanguage: "pt-BR",
    description:
      "Aplicativo de finanças pessoais que entende mensagem e áudio: você conta o que gastou e o lançamento aparece organizado, no cartão certo.",
    publisher: {
      "@type": "Organization",
      name: "ProOps",
      url: SITE_URLS.institucional,
    },
    offers: PLANOS.map((plano) => ({
      "@type": "Offer",
      name: plano.nome,
      price: precoNumerico(plano.mensal),
      priceCurrency: "BRL",
      category: "subscription",
      availability: "https://schema.org/PreOrder",
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * "R$ 24,90" as "24.90".
 *
 * schema.org wants a plain decimal with a dot, and `priceCurrency` carries the
 * currency separately. Sending the formatted string makes Google drop the offer
 * silently, which looks exactly like having no structured data at all.
 */
function precoNumerico(formatado: string): string {
  return formatado.replace(/[^\d,]/g, "").replace(",", ".");
}
