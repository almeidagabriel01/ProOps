import { MessageCircle, CalendarDays, Ruler, Layers, Palette, CreditCard, ArrowUpDown, LayoutGrid } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "cortinas",
  hero: {
    eyebrow: "",
    title: "ERP para",
    titleHighlight: "Persianas e Toldos",
    subtitle:
      "A ProOps tem um pacote pronto para empresas de persianas, cortinas, toldos e pergolados: proposta por ambiente com preço por medida, catálogo com fotos, obra, CRM e financeiro integrados.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("cortinas") },
    secondaryCta: { label: "Fazer login", href: "/login" },
  },
  features: [
    {
      icon: Ruler,
      title: "Preço por medida",
      description:
        "Cobre por metro quadrado, por metro de largura ou por faixa de altura. Informe as medidas do vão e o total sai na hora, com o markup do produto.",
    },
    {
      icon: Layers,
      title: "Proposta por ambiente",
      description:
        "Sala, suíte, varanda: cada ambiente com os produtos padrão já definidos. Monte a proposta escolhendo os ambientes e ajuste as medidas.",
    },
    {
      icon: Palette,
      title: "Catálogo com fotos",
      description:
        "Cadastre tecidos, lonas, motores e acessórios com até três fotos por produto. As fotos aparecem no PDF da proposta.",
    },
    {
      icon: CreditCard,
      title: "Financeiro integrado",
      description:
        "Ao aprovar um orçamento, entradas e parcelas são criadas automaticamente no financeiro. Controle entradas e saídas sem planilhas.",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp integrado",
      description:
        "Envie propostas e notificações pelo WhatsApp diretamente da plataforma. Comunique-se de forma profissional com cada cliente.",
    },
    {
      icon: CalendarDays,
      title: "Da medição à entrega",
      description:
        "Marque a medição técnica na agenda e acompanhe cada obra por etapas: medição, produção, instalação e entrega.",
    },
  ],
  modulesSection: {
    title: "Três modos de preço por medida",
    subtitle:
      "Cada produto escolhe como é cobrado, e a proposta calcula o total a partir das medidas do vão.",
  },
  modules: [
    {
      icon: Ruler,
      title: "Por área (m²)",
      description:
        "Largura x altura do vão x número de painéis x preço por m². Para persianas rolô, romanas e painéis.",
      bullets: [
        "Largura e altura em metros",
        "Mais de um painel ou folha no mesmo vão",
        "Markup configurável por produto",
      ],
    },
    {
      icon: ArrowUpDown,
      title: "Por faixa de altura",
      description:
        "Tabela de preço por faixa de altura, multiplicada pela largura. Para cortinas de trilho e persianas cujo custo muda com o tamanho.",
      bullets: [
        "Faixas escalonadas por altura",
        "Custo e markup próprios em cada faixa",
        "Configuração por produto no catálogo",
      ],
    },
    {
      icon: LayoutGrid,
      title: "Por metro de largura",
      description:
        "Preço por metro linear, multiplicado pela largura e pelo número de peças. Para toldos, trilhos e bandôs.",
      bullets: [
        "Largura em metros",
        "Várias peças no mesmo vão",
        "Motor e acessórios como item por unidade",
      ],
    },
  ],
  faq: [
    {
      question: "A ProOps funciona para empresas de persianas, cortinas e toldos?",
      answer:
        "Sim. O pacote de persianas e toldos já vem com preço por medida, proposta por ambiente e etapas de obra da medição à entrega. A ProOps também tem um pacote pronto para automação residencial.",
    },
    {
      question: "Posso incluir fotos dos produtos nas propostas?",
      answer:
        "Sim. Ao cadastrar um produto no catálogo, você adiciona até três fotos. Elas aparecem automaticamente no PDF da proposta.",
    },
    {
      question: "O sistema calcula o preço total automaticamente?",
      answer:
        "Sim. Com as medidas do vão e o preço por m², por metro de largura ou pela faixa de altura, a ProOps calcula o total da proposta e, na aprovação, gera o financeiro.",
    },
    {
      question: "Qual o custo para começar?",
      answer:
        "Você cria uma conta gratuita e navega a ProOps em modo demonstração, com dados de exemplo de persianas e toldos, antes de assinar.",
    },
  ],
  cta: {
    title: "Sua empresa de persianas e toldos merece um sistema profissional",
    subtitle:
      "Propostas por medida, obra organizada e financeiro em dia, em um só lugar.",
    crossLink: {
      label: "Ver também: ERP para Automação Residencial",
      href: NICHE_REGISTRY.automacao_residencial.landingPath,
    },
  },
  seo: {
    metadataTitle: "ERP para Persianas e Toldos: propostas por medida e gestão",
    metadataDescription:
      "ProOps para empresas de persianas, cortinas e toldos: preço por m², por largura ou por faixa de altura, proposta por ambiente, obra, CRM e financeiro.",
    breadcrumb: "Persianas e Toldos",
    keywords: [
      "ERP persianas",
      "sistema para empresa de toldos",
      "sistema gestão loja cortinas",
      "orçamento de persianas por m²",
      "software proposta decoração",
    ],
    ogTitle: "ERP para Persianas e Toldos | ProOps",
    ogDescription:
      "Propostas por ambiente com preço por medida, obra, CRM e financeiro para empresas de persianas, cortinas e toldos.",
  },
  gallery: {
    icon: Layers,
    eyebrow: "Pacote pronto",
    title: "Persianas e Toldos",
    description:
      "Propostas por ambiente com preço por m², por largura ou por faixa de altura. Catálogo de tecidos, lonas e motores com fotos.",
    features: ["Preço por medida", "Proposta por ambiente", "Obra da medição à entrega"],
  },
};
