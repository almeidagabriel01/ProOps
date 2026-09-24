import { ORGANIZACAO_REF } from "@/components/seo/json-ld";
import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS } from "@/lib/site/surfaces";

import { PERGUNTAS } from "../_content/faq";
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
  const aplicativo = {
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
      "Aplicativo de finanças pessoais operado por mensagem: você pede em português corrente, no WhatsApp ou dentro do aplicativo, e ele lança, transfere, parcela, paga fatura e projeta o mês.",
    // A lista é o que separa este aplicativo da categoria, e cada item tem uma
    // ferramenta determinística por trás no repositório do produto. Não
    // acrescente recurso aqui que a página não mostre: `featureList` é
    // descrição pública, e descrição pública que não bate com a tela é o tipo de
    // divergência que o cliente encontra antes da gente.
    featureList: [
      "Lançamento por mensagem de texto ou áudio no WhatsApp",
      "O mesmo agente dentro do aplicativo",
      "Transferência entre contas, compra parcelada e pagamento de fatura",
      "Simulação de compra antes do gasto",
      "Cartões, faturas, orçamentos, metas e patrimônio",
      "Projeção do saldo até o fim do mês",
      "Notas e lembretes recorrentes",
      "Importação de extrato em OFX e CSV",
      "Financeiro compartilhado entre pessoas da mesma casa",
    ],
    publisher: ORGANIZACAO_REF,
    offers: PLANOS.map((plano) => ({
      "@type": "Offer",
      name: plano.nome,
      price: precoNumerico(plano.mensal),
      priceCurrency: "BRL",
      category: "subscription",
      availability: "https://schema.org/PreOrder",
    })),
  };

  /**
   * O FAQ, como dado estruturado.
   *
   * Os cinco concorrentes diretos publicam `FAQPage`, e é o que rende o bloco
   * expansível no resultado do Google. As perguntas saem de `_content/faq`, o
   * mesmo array que a seção renderiza: a política do Google exige que a resposta
   * do snippet seja visível na página, então tela e schema divergindo não é só
   * inconsistência, é motivo de perder o rich result.
   *
   * Um `<script>` separado, e não um `@graph`: são duas entidades sem relação, e
   * um erro de sintaxe numa derrubaria a outra junto.
   */
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PERGUNTAS.map((item) => ({
      "@type": "Question",
      name: item.pergunta,
      acceptedAnswer: { "@type": "Answer", text: item.resposta },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aplicativo) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
    </>
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
