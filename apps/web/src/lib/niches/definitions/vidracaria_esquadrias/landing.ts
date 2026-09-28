import { MessageCircle, CalendarDays, Ruler, Layers, Palette, CreditCard, LayoutGrid, Package } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "vidracaria_esquadrias",
  hero: {
    eyebrow: "",
    title: "ERP para",
    titleHighlight: "Vidraçaria e Esquadrias",
    subtitle:
      "A ProOps tem um pacote pronto para vidraçarias e empresas de esquadrias: orçamento por m² a partir das medidas do vão, proposta por ambiente, agenda de medição, obra da têmpera à instalação, CRM e financeiro integrados.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("vidracaria_esquadrias") },
    secondaryCta: { label: "Fazer login", href: "/login" },
  },
  features: [
    {
      icon: Ruler,
      title: "Orçamento por m²",
      description:
        "Informe largura e altura do vão e o total sai na hora, com o preço do m² e o markup de cada vidro. Perfil e pingadeira podem ser cobrados por metro linear.",
    },
    {
      icon: Layers,
      title: "Proposta por ambiente",
      description:
        "Banheiro, sacada, fachada: cada ambiente com os vidros e esquadrias padrão já definidos. Monte a proposta escolhendo os ambientes e ajuste as medidas.",
    },
    {
      icon: Palette,
      title: "Catálogo com fotos",
      description:
        "Cadastre vidros, kits de box, esquadrias e acessórios com até três fotos por produto. As fotos aparecem no PDF da proposta.",
    },
    {
      icon: CalendarDays,
      title: "Da medição à instalação",
      description:
        "Marque a medição na agenda e acompanhe cada obra por etapas: medição, têmpera e produção, instalação e entrega.",
    },
    {
      icon: CreditCard,
      title: "Financeiro integrado",
      description:
        "Ao aprovar um orçamento, o sinal e as parcelas são criados automaticamente no financeiro. Controle entradas e saídas sem planilhas.",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp integrado",
      description:
        "Envie a proposta pelo WhatsApp direto da plataforma e acompanhe quando o cliente abre e aceita.",
    },
  ],
  modulesSection: {
    title: "Do vão medido ao orçamento aprovado",
    subtitle:
      "Cada produto escolhe como é cobrado, e a proposta calcula o total a partir das medidas que a sua equipe tirou na obra.",
  },
  modules: [
    {
      icon: Ruler,
      title: "Por m²",
      description:
        "Largura x altura do vão x número de folhas x preço do m². Para vidro temperado, laminado, espelho, box e fechamento de sacada.",
      bullets: [
        "Largura e altura em metros",
        "Mais de uma folha no mesmo vão",
        "Markup configurável por produto",
      ],
    },
    {
      icon: LayoutGrid,
      title: "Por metro linear",
      description:
        "Preço por metro, multiplicado pela largura. Para perfis, trilhos, pingadeiras e guarda-corpos cobrados pelo comprimento.",
      bullets: [
        "Largura em metros",
        "Várias peças no mesmo vão",
        "Custo e markup próprios",
      ],
    },
    {
      icon: Package,
      title: "Por unidade",
      description:
        "Kits de box, fechaduras, puxadores, roldanas e a instalação como item fechado, ao lado dos vidros cobrados por medida.",
      bullets: [
        "Kit e acessório por peça",
        "Serviço de instalação na mesma proposta",
        "Estoque controlado no catálogo",
      ],
    },
  ],
  faq: [
    {
      question: "A ProOps funciona para vidraçaria e empresa de esquadrias?",
      answer:
        "Sim. O pacote de vidraçaria e esquadrias já vem com orçamento por m², proposta por ambiente e etapas de obra da medição à instalação. Persianas e cortinas entram no mesmo catálogo, se a sua empresa também vende.",
    },
    {
      question: "A ProOps calcula o corte dos perfis de alumínio?",
      answer:
        "Não. A ProOps cuida do comercial e da gestão: orçamento por medida, proposta com PDF, obra, agenda e financeiro. O cálculo técnico de esquadria por tipologia continua no programa que a sua fábrica já usa.",
    },
    {
      question: "O sistema calcula o preço total automaticamente?",
      answer:
        "Sim. Com as medidas do vão e o preço do m² ou do metro linear, a ProOps calcula o total da proposta e, na aprovação, gera o financeiro.",
    },
    {
      question: "Qual o custo para começar?",
      answer:
        "Você cria uma conta gratuita e navega a ProOps em modo demonstração, com dados de exemplo de vidraçaria, antes de assinar.",
    },
  ],
  cta: {
    title: "Sua vidraçaria merece um sistema profissional",
    subtitle: "Orçamentos por medida, obra organizada e financeiro em dia, em um só lugar.",
    crossLink: {
      label: "Ver também: ERP para Persianas e Toldos",
      href: NICHE_REGISTRY.cortinas.landingPath,
    },
  },
  seo: {
    metadataTitle: "ERP para Vidraçaria e Esquadrias: orçamento por m² e gestão",
    metadataDescription:
      "ProOps para vidraçarias e empresas de esquadrias: orçamento por m² a partir das medidas do vão, proposta por ambiente, obra, CRM e financeiro.",
    breadcrumb: "Vidraçaria e Esquadrias",
    keywords: [
      "sistema para vidraçaria",
      "ERP vidraçaria",
      "orçamento de vidro temperado",
      "software para esquadrias de alumínio",
      "orçamento de box por m²",
    ],
    ogTitle: "ERP para Vidraçaria e Esquadrias | ProOps",
    ogDescription:
      "Orçamento por m², proposta por ambiente, obra, CRM e financeiro para vidraçarias e empresas de esquadrias.",
  },
  gallery: {
    icon: Ruler,
    eyebrow: "Pacote pronto",
    title: "Vidraçaria e Esquadrias",
    description:
      "Orçamento por m² a partir das medidas do vão, proposta por ambiente e obra da medição à instalação.",
    features: ["Orçamento por m²", "Proposta por ambiente", "Obra da medição à instalação"],
  },
};
