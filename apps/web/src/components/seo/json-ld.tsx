import { APEX_URL } from "@/lib/site/surfaces";
import { origemDe } from "@/lib/site/host-seo";

/**
 * Onde o ERP mora, para o dado estruturado dele.
 *
 * Era `NEXT_PUBLIC_SITE_URL`, que é lida no BUILD e não sabe qual host está
 * sendo servido. Depois da virada isso faria a landing do ERP, servida em
 * `erp.proops.com.br`, declarar `url: https://proops.com.br` — o endereço da
 * página institucional. `origemDe` devolve o apex hoje e o subdomínio depois,
 * sem depender de ninguém lembrar de trocar uma variável de ambiente.
 */
const BASE = origemDe("erp");

/**
 * O nó da empresa, declarado uma vez só, na página institucional
 * (`InstitucionalJsonLd`). Os produtos o citam por este `@id` em vez de repetir
 * um `Organization` próprio: a landing do ERP chegou a publicar um segundo, sem
 * `sameAs` e sem `owns`, e duas organizações com o mesmo nome em dois hosts é
 * justamente o sinal que impede o Google de ver os três sites como uma empresa.
 */
export const ORGANIZACAO_ID = `${APEX_URL}/#organization`;

/**
 * A referência à empresa para páginas FORA do apex. Leva nome e URL junto do
 * `@id` porque um `@id` sozinho só é resolvido dentro do mesmo documento: numa
 * página do ERP ou do app ele seria um nó vazio.
 */
export const ORGANIZACAO_REF = {
  "@type": "Organization",
  "@id": ORGANIZACAO_ID,
  name: "ProOps",
  url: `${APEX_URL}/`,
} as const;

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
    ? `ProOps para empresas de ${nicheNames[niche]}: propostas, CRM, financeiro, agenda e WhatsApp. ERP que adapta-se ao seu negócio.`
    : "ERP completo para empresas de serviço: propostas, CRM, financeiro, agenda e WhatsApp integrados.";

  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ProOps",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: BASE,
    description,
    // Sem `aggregateRating`: a nota que estava aqui (4,8 com 50 avaliações) não
    // existia. Nota inventada em dado estruturado é violação de política do
    // Google, com ação manual que derruba os rich results do domínio inteiro.
    // Sem `offers` também: um `Offer` sem `price` é erro no Rich Results Test, e
    // o preço do ERP vem da Stripe em tempo de execução.
    publisher: ORGANIZACAO_REF,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * O `WebSite` do ERP, com nome próprio.
 *
 * "ProOps", sem qualificador, é o nome do site do APEX (`InstitucionalJsonLd`),
 * que é quem deve aparecer como a ProOps num resultado de busca. Aqui já houve
 * uma `SearchAction` com `?q={search_term_string}`: o site não tem busca, o
 * Google aposentou a caixa de busca de sitelinks em 2024, e o rastreador
 * visitava a URL literal do modelo, que aparecia no Search Console.
 */
export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ProOps ERP",
    url: `${BASE}/`,
    inLanguage: "pt-BR",
    publisher: ORGANIZACAO_REF,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface FAQPageJsonLdProps {
  items: { question: string; answer: string }[];
}

export function FAQPageJsonLd({ items }: FAQPageJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
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
