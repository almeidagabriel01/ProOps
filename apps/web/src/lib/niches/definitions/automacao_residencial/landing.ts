import { FileText, Kanban, DollarSign, Package, MessageCircle, CalendarDays, Layers, Cpu } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "automacao_residencial",
  hero: {
    eyebrow: "",
    title: "ERP para",
    titleHighlight: "Automação Residencial",
    subtitle:
      "A ProOps tem um pacote pronto para integradores e empresas de automação residencial: gestão de propostas, CRM, financeiro e agenda integrados em um só lugar.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("automacao_residencial") },
    secondaryCta: { label: "Fazer login", href: "/login" },
  },
  features: [
    {
      icon: FileText,
      title: "Propostas com PDF profissional",
      description:
        "Monte propostas detalhadas com lista de produtos, preços, prazo e condições de pagamento. Gere PDF com sua marca e envie direto ao cliente.",
    },
    {
      icon: Kanban,
      title: "CRM Kanban para projetos",
      description:
        "Acompanhe cada oportunidade em quadro Kanban visual. Saiba exatamente em qual etapa cada projeto está e nunca perca um follow-up.",
    },
    {
      icon: DollarSign,
      title: "Financeiro integrado",
      description:
        "Ao aprovar uma proposta, as parcelas são criadas automaticamente no financeiro. Controle o fluxo de caixa sem planilhas.",
    },
    {
      icon: Package,
      title: "Catálogo de produtos",
      description:
        "Cadastre painéis, centrais, sensores e câmeras com fotos e preços. Adicione a propostas em segundos.",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp integrado",
      description:
        "Notifique clientes pelo WhatsApp quando a proposta é enviada ou aprovada. Comunicação profissional sem sair da plataforma.",
    },
    {
      icon: CalendarDays,
      title: "Agenda e calendário",
      description:
        "Organize visitas técnicas, instalações e reuniões com integração ao Google Calendar para sua equipe.",
    },
  ],
  modulesSection: {
    title: "Módulos específicos para automação",
    subtitle:
      "A ProOps oferece módulos pensados para a realidade de integradores e empresas de AV.",
  },
  modules: [
    {
      icon: Package,
      title: "Catálogo de produtos",
      description:
        "Sensores, câmeras, painéis de controle e centrais de automação com fotos e especificações técnicas.",
      bullets: [
        "Equipamentos com especificações técnicas e fotos",
        "Fichas de produto exportadas no PDF da proposta",
        "Adição direta a qualquer proposta em segundos",
      ],
    },
    {
      icon: Layers,
      title: "Sistemas e ambientes",
      description:
        "Monte soluções completas por cômodo: iluminação, climatização, segurança e entretenimento, organizados por ambiente.",
      bullets: [
        "Soluções por ambiente: iluminação, segurança, climatização",
        "Templates reutilizáveis por tipo de projeto",
        "Visão consolidada de itens e valores por cômodo",
      ],
    },
    {
      icon: FileText,
      title: "Propostas com PDF profissional",
      description:
        "Gere propostas técnicas e comerciais em PDF com capa personalizada, lista de itens, valores e condições de pagamento.",
      bullets: [
        "Capa personalizada com logotipo e cores da empresa",
        "Lista de itens com preços e condições negociadas",
        "Geração de PDF e envio ao cliente em segundos",
      ],
    },
  ],
  faq: [
    {
      question: "A ProOps é específica para automação residencial?",
      answer:
        "Não exclusivamente. A ProOps adapta-se ao seu nicho: para automação residencial já temos catálogo de produtos, templates de proposta e campos específicos prontos. Também personalizamos para outros segmentos.",
    },
    {
      question: "Posso personalizar os templates de proposta com minha marca?",
      answer:
        "Sim. Você adiciona logotipo, cores e informações da sua empresa. O PDF gerado sai com a identidade visual do seu negócio.",
    },
    {
      question: "Tem app mobile?",
      answer:
        "A ProOps é uma plataforma web responsiva que funciona bem em smartphones e tablets. Um app nativo está no roadmap.",
    },
    {
      question: "Qual o custo para começar?",
      answer:
        "Você cria uma conta gratuita e navega a ProOps em modo demonstração antes de assinar. Os planos pagos começam com preço acessível para pequenas empresas e integradores independentes.",
    },
  ],
  cta: {
    title: "Profissionalize sua empresa de automação residencial",
    subtitle:
      "Junte-se a integradores que já usam a ProOps para fechar mais projetos com propostas profissionais.",
    crossLink: {
      label: "Ver também: ERP para Persianas e Toldos",
      href: NICHE_REGISTRY.cortinas.landingPath,
    },
  },
  seo: {
    metadataTitle:
      "ERP para Automação Residencial: propostas, projetos e gestão",
    metadataDescription:
      "ProOps é o sistema ERP especializado para empresas de automação residencial. Gerencie propostas comerciais com PDF profissional, CRM, financeiro, agenda e WhatsApp em uma plataforma integrada.",
    breadcrumb: "Automação Residencial",
    keywords: [
      "ERP automação residencial",
      "sistema gestão automação residencial",
      "software proposta automação residencial",
      "CRM integradores",
      "ERP integradores AV",
      "gestão projetos automação",
      "proposta comercial automação residencial",
    ],
    ogTitle: "ERP para Automação Residencial | ProOps",
    ogDescription:
      "Sistema completo para integradores: propostas em PDF, CRM, financeiro, agenda e WhatsApp integrados.",
  },
  gallery: {
    icon: Cpu,
    eyebrow: "Pacote pronto",
    title: "Automação Residencial",
    description:
      "Gerencie projetos de automação com catálogo de produtos, sistemas por ambiente e propostas técnicas em PDF profissional.",
    features: ["Catálogo de produtos", "Sistemas por ambiente", "PDF técnico"],
  },
};
