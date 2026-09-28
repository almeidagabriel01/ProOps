import { MessageCircle, CalendarDays, Ruler, Layers, Palette, CreditCard, LayoutGrid, Package } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "moveis_planejados",
  hero: {
    eyebrow: "",
    title: "ERP para",
    titleHighlight: "Móveis Planejados",
    subtitle:
      "A ProOps tem um pacote pronto para marcenarias e lojas de móveis planejados: orçamento por m² ou por metro linear, proposta por ambiente, agenda de medição, obra do projeto à montagem, CRM e financeiro integrados.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("moveis_planejados") },
    secondaryCta: { label: "Fazer login", href: "/login" },
  },
  features: [
    {
      icon: Ruler,
      title: "Orçamento por medida",
      description:
        "Informe as medidas do móvel e o total sai na hora: por m² de frente, por metro linear de armário ou por unidade, com o markup de cada produto.",
    },
    {
      icon: Layers,
      title: "Proposta por ambiente",
      description:
        "Cozinha, dormitório, closet: cada ambiente com os móveis padrão já definidos. Monte a proposta escolhendo os ambientes e ajuste as medidas.",
    },
    {
      icon: Palette,
      title: "Catálogo com fotos",
      description:
        "Cadastre módulos, painéis, ferragens e acabamentos com até três fotos por produto. As fotos aparecem no PDF da proposta.",
    },
    {
      icon: CalendarDays,
      title: "Do projeto à montagem",
      description:
        "Marque a medição na agenda e acompanhe cada obra por etapas: medição, projeto, produção, montagem e entrega.",
    },
    {
      icon: CreditCard,
      title: "Financeiro integrado",
      description:
        "Ao aprovar um orçamento, a entrada e as parcelas são criadas automaticamente no financeiro. Controle entradas e saídas sem planilhas.",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp integrado",
      description:
        "Envie a proposta pelo WhatsApp direto da plataforma e acompanhe quando o cliente abre e aceita.",
    },
  ],
  modulesSection: {
    title: "Do ambiente medido ao orçamento aprovado",
    subtitle:
      "Cada produto escolhe como é cobrado, e a proposta calcula o total a partir das medidas que a sua equipe tirou no local.",
  },
  modules: [
    {
      icon: Ruler,
      title: "Por m²",
      description:
        "Largura x altura x preço do m². Para armários, painéis, portas e roupeiros cobrados pela área de frente.",
      bullets: ["Largura e altura em metros", "Mais de uma peça no mesmo ambiente", "Markup configurável por produto"],
    },
    {
      icon: LayoutGrid,
      title: "Por metro linear",
      description:
        "Preço por metro, multiplicado pela largura. Para armários de cozinha, bancadas, rodapés e prateleiras.",
      bullets: ["Largura em metros", "Várias peças no mesmo ambiente", "Custo e markup próprios"],
    },
    {
      icon: Package,
      title: "Por unidade",
      description:
        "Ferragens, puxadores, iluminação e a montagem como item fechado, ao lado dos móveis cobrados por medida.",
      bullets: ["Kit e acessório por peça", "Serviço de montagem na mesma proposta", "Estoque controlado no catálogo"],
    },
  ],
  faq: [
    {
      question: "A ProOps funciona para marcenaria e loja de móveis planejados?",
      answer:
        "Sim. O pacote de móveis planejados já vem com orçamento por m² e por metro linear, proposta por ambiente e etapas de obra da medição à montagem.",
    },
    {
      question: "A ProOps desenha o projeto 3D ou o plano de corte?",
      answer:
        "Não. A ProOps cuida do comercial e da gestão: orçamento, proposta com PDF, obra, agenda e financeiro. O projeto 3D e o plano de corte continuam no programa que a sua marcenaria já usa.",
    },
    {
      question: "O sistema calcula o preço total automaticamente?",
      answer:
        "Sim. Com as medidas e o preço do m², do metro linear ou da unidade, a ProOps calcula o total da proposta e, na aprovação, gera o financeiro.",
    },
    {
      question: "Qual o custo para começar?",
      answer:
        "Você cria uma conta gratuita e navega a ProOps em modo demonstração, com dados de exemplo de móveis planejados, antes de assinar.",
    },
  ],
  cta: {
    title: "Sua marcenaria merece um sistema profissional",
    subtitle: "Orçamentos por medida, obra organizada e financeiro em dia, em um só lugar.",
    crossLink: {
      label: "Ver também: ERP para Vidraçaria e Esquadrias",
      href: NICHE_REGISTRY.vidracaria_esquadrias.landingPath,
    },
  },
  seo: {
    metadataTitle: "ERP para Móveis Planejados: orçamento por medida e gestão",
    metadataDescription:
      "ProOps para marcenarias e lojas de móveis planejados: orçamento por m² e por metro linear, proposta por ambiente, obra, CRM e financeiro.",
    breadcrumb: "Móveis Planejados",
    keywords: [
      "sistema para marcenaria",
      "ERP móveis planejados",
      "orçamento de móveis planejados",
      "software para marcenaria",
      "sistema gestão marcenaria",
    ],
    ogTitle: "ERP para Móveis Planejados | ProOps",
    ogDescription:
      "Orçamento por medida, proposta por ambiente, obra, CRM e financeiro para marcenarias e lojas de móveis planejados.",
  },
  gallery: {
    icon: LayoutGrid,
    eyebrow: "Pacote pronto",
    title: "Móveis Planejados",
    description:
      "Orçamento por m² e por metro linear, proposta por ambiente e obra do projeto à montagem.",
    features: ["Orçamento por medida", "Proposta por ambiente", "Obra do projeto à montagem"],
  },
};
