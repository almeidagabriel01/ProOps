import { FileText, Package, CalendarDays, Layers, CreditCard, Camera, ShieldCheck, Repeat } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "seguranca_eletronica",
  hero: {
    eyebrow: "",
    title: "ERP para",
    titleHighlight: "Segurança Eletrônica",
    subtitle:
      "A ProOps tem um pacote pronto para instaladores e integradores de CFTV, alarme, controle de acesso e cerca elétrica: proposta por sistema e área, obra por etapas, CRM e financeiro integrados.",
    primaryCta: {
      label: "Começar agora",
      href: signupHrefForNiche("seguranca_eletronica"),
    },
    secondaryCta: { label: "Fazer login", href: "/login" },
  },
  features: [
    {
      icon: Camera,
      title: "Proposta por sistema e área",
      description:
        "Monte kits de CFTV, alarme e controle de acesso uma vez e adicione o sistema inteiro à proposta, área por área.",
    },
    {
      icon: Package,
      title: "Catálogo de equipamentos",
      description:
        "Câmeras, gravadores, sensores, centrais e leitores com preço, markup e estoque, prontos para entrar na proposta.",
    },
    {
      icon: CalendarDays,
      title: "Da vistoria à entrega",
      description:
        "Marque a vistoria técnica na agenda e acompanhe a obra por etapas: levantamento, infraestrutura, instalação, configuração e entrega.",
    },
    {
      icon: Repeat,
      title: "Mensalidades no financeiro",
      description:
        "Lance contratos de manutenção e monitoramento como recorrência no financeiro, junto das parcelas da instalação.",
    },
    {
      icon: FileText,
      title: "PDF profissional",
      description:
        "Proposta em PDF com a sua marca, os sistemas separados e o subtotal de cada um.",
    },
    {
      icon: CreditCard,
      title: "Financeiro integrado",
      description:
        "Ao aprovar um orçamento, entradas e parcelas são criadas automaticamente no financeiro. Controle entradas e saídas sem planilhas.",
    },
  ],
  modulesSection: {
    title: "Feito para quem instala e integra",
    subtitle:
      "A ProOps organiza a venda, a obra e o financeiro. A central de monitoramento continua no software que você já usa.",
  },
  modules: [
    {
      icon: ShieldCheck,
      title: "CFTV e alarme",
      description:
        "Kits prontos por área: câmeras, gravador, sensores e central, com a mão de obra junto.",
      bullets: [
        "Kits reaproveitados em toda proposta",
        "Produto e serviço separados",
        "Subtotal por sistema no PDF",
      ],
    },
    {
      icon: Layers,
      title: "Controle de acesso e cerca",
      description:
        "Fechaduras, leitores biométricos, cancelas e cerca elétrica no mesmo projeto.",
      bullets: [
        "Vários sistemas na mesma proposta",
        "Quantidades ajustadas por projeto",
        "Estoque por unidade",
      ],
    },
    {
      icon: Repeat,
      title: "Contratos recorrentes",
      description:
        "Manutenção preventiva e monitoramento terceirizado como lançamento recorrente no financeiro.",
      bullets: [
        "Recorrência mensal no financeiro",
        "Cobrança por PIX, boleto ou cartão no plano com pagamento online",
        "Nota fiscal de serviço no plano com o módulo fiscal",
      ],
    },
  ],
  faq: [
    {
      question: "A ProOps substitui o software da central de monitoramento?",
      answer:
        "Não. A ProOps cuida da venda, da obra e do financeiro de quem instala e integra. O recebimento de eventos e a portaria remota continuam no software da central.",
    },
    {
      question: "Consigo montar kits de câmeras e alarme?",
      answer:
        "Sim. Em Sistemas você monta cada kit uma vez, com as áreas e os produtos padrão, e adiciona o sistema inteiro à proposta.",
    },
    {
      question: "Dá para controlar as mensalidades?",
      answer:
        "Sim. Contratos de manutenção e monitoramento entram como lançamentos recorrentes no financeiro.",
    },
    {
      question: "Qual o custo para começar?",
      answer:
        "Você cria uma conta gratuita e navega a ProOps em modo demonstração, com dados de exemplo de segurança eletrônica, antes de assinar.",
    },
  ],
  cta: {
    title: "Sua empresa de segurança eletrônica merece um sistema profissional",
    subtitle: "Propostas claras, obra organizada e financeiro em dia, em um só lugar.",
    crossLink: {
      label: "Ver também: ERP para Automação Residencial",
      href: NICHE_REGISTRY.automacao_residencial.landingPath,
    },
  },
  seo: {
    metadataTitle: "ERP para Segurança Eletrônica: propostas de CFTV, alarme e acesso",
    metadataDescription:
      "ProOps para instaladores de segurança eletrônica: proposta por sistema e área, obra por etapas, CRM, financeiro e mensalidades. ERP que adapta-se ao seu negócio.",
    breadcrumb: "Segurança Eletrônica",
    keywords: [
      "ERP segurança eletrônica",
      "sistema para empresa de CFTV",
      "software proposta CFTV",
      "sistema gestão instalador de alarme",
      "ERP controle de acesso",
    ],
    ogTitle: "ERP para Segurança Eletrônica | ProOps",
    ogDescription:
      "Proposta por sistema e área, obra por etapas, CRM, financeiro e mensalidades para instaladores de segurança eletrônica.",
  },
  gallery: {
    icon: ShieldCheck,
    eyebrow: "Pacote pronto",
    title: "Segurança Eletrônica",
    description:
      "Proposta por sistema e área para CFTV, alarme e controle de acesso, obra por etapas e mensalidades no financeiro.",
    features: ["Kits por sistema", "Obra da vistoria à entrega", "Mensalidades no financeiro"],
  },
};
