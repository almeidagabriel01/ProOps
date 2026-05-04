import {
  FileText,
  Kanban,
  DollarSign,
  Package,
  MessageCircle,
  CalendarDays,
  Ruler,
  Layers,
  Palette,
  CreditCard,
  ArrowUpDown,
  LayoutGrid,
} from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";

export const NICHE_LANDING_CONFIG: Record<
  "automacao_residencial" | "cortinas",
  NicheLandingConfig
> = {
  automacao_residencial: {
    slug: "automacao_residencial",
    hero: {
      eyebrow: "",
      title: "ERP para",
      titleHighlight: "Automação Residencial",
      subtitle:
        "O ProOps foi criado para integradores e empresas de automação residencial que precisam profissionalizar suas propostas comerciais, organizar o CRM e controlar o financeiro em um só lugar.",
      primaryCta: { label: "Começar grátis", href: "/register" },
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
        "O ProOps oferece módulos pensados para a realidade de integradores e empresas de AV.",
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
          "Monte soluções completas por cômodo — iluminação, climatização, segurança e entretenimento — organizados por ambiente.",
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
        question: "O ProOps é específico para automação residencial?",
        answer:
          "Sim. O ProOps tem suporte nativo ao nicho de automação residencial com catálogo de produtos, templates de proposta e campos específicos para projetos de integração AV.",
      },
      {
        question: "Posso personalizar os templates de proposta com minha marca?",
        answer:
          "Sim. Você adiciona logotipo, cores e informações da sua empresa. O PDF gerado sai com a identidade visual do seu negócio.",
      },
      {
        question: "Tem app mobile?",
        answer:
          "O ProOps é um sistema web responsivo que funciona bem em smartphones e tablets. Um app nativo está no roadmap.",
      },
      {
        question: "Qual o custo para começar?",
        answer:
          "Há um plano gratuito para você testar. Os planos pagos começam com preço acessível para pequenas empresas e integradores independentes.",
      },
    ],
    cta: {
      title: "Profissionalize sua empresa de automação residencial",
      subtitle:
        "Junte-se a integradores que já usam o ProOps para fechar mais projetos com propostas profissionais.",
      crossLink: {
        label: "Ver também: ERP para Decoração",
        href: "/decoracao",
      },
    },
    seo: {
      metadataTitle:
        "ERP para Automação Residencial — propostas, projetos e gestão",
      metadataDescription:
        "ProOps é o sistema ERP especializado para empresas de automação residencial. Gerencie propostas comerciais com PDF profissional, CRM, financeiro, agenda e WhatsApp em uma plataforma integrada.",
      breadcrumb: "Automação Residencial",
    },
  },

  cortinas: {
    slug: "cortinas",
    hero: {
      eyebrow: "",
      title: "ERP para",
      titleHighlight: "Lojas de Decoração",
      subtitle:
        "Propostas com cálculo automático de metros, catálogo de tecidos, persianas e papéis de parede, CRM e financeiro integrados.",
      primaryCta: { label: "Começar grátis", href: "/register" },
      secondaryCta: { label: "Fazer login", href: "/login" },
    },
    features: [
      {
        icon: Ruler,
        title: "Cálculo por metro quadrado",
        description:
          "Monte propostas com cálculo automático por m², por largura de painel ou por faixa de altura. O preço total é calculado em tempo real.",
      },
      {
        icon: Layers,
        title: "Catálogo de tecidos e materiais",
        description:
          "Cadastre cortinas, persianas, papéis de parede, trilhos e acessórios com fotos e preços. Adicione a propostas em segundos.",
      },
      {
        icon: Palette,
        title: "Múltiplos modos de precificação",
        description:
          "Configure preços por m², por largura com painéis, por faixa de altura ou preço fixo. Flexibilidade total para o seu modelo de negócio.",
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
        title: "Agenda de instalações",
        description:
          "Organize visitas de medição e instalações com calendário integrado. Sua equipe fica alinhada e o cliente recebe confirmação automática.",
      },
    ],
    modulesSection: {
      title: "Modos de precificação para decoração",
      subtitle:
        "O ProOps oferece três modelos de cálculo de preço específicos para lojas de decoração.",
    },
    modules: [
      {
        icon: Ruler,
        title: "Precificação por m²",
        description:
          "Defina o preço por metro quadrado e o ProOps calcula o total automaticamente ao informar largura e altura de cada ambiente.",
        bullets: [
          "Largura e altura em qualquer unidade de medida",
          "Cálculo automático do total sem erro manual",
          "Margem e markup configuráveis por produto",
        ],
      },
      {
        icon: ArrowUpDown,
        title: "Por faixa de altura",
        description:
          "Configure tabelas de preço por faixa de altura — ideal para persianas e cortinas com variação de custo por tamanho.",
        bullets: [
          "Tabelas de preço escalonadas por tamanho",
          "Ideal para persianas e cortinas sob medida",
          "Configuração flexível por produto no catálogo",
        ],
      },
      {
        icon: LayoutGrid,
        title: "Largura com painéis",
        description:
          "Para papéis de parede e revestimentos vendidos em painéis ou rolos, calcule automaticamente a quantidade e o custo total.",
        bullets: [
          "Cálculo de rolos e painéis automaticamente",
          "Suporte a papéis de parede e revestimentos",
          "Sem cálculo manual, sem erro de quantidade",
        ],
      },
    ],
    faq: [
      {
        question: "O ProOps funciona para lojas de cortinas e persianas?",
        answer:
          "Sim. O ProOps tem suporte nativo ao nicho de decoração, com campos específicos para medidas, tipos de produto e ambiente do cliente.",
      },
      {
        question: "Posso incluir fotos dos produtos nas propostas?",
        answer:
          "Sim. Ao cadastrar um produto no catálogo, você adiciona a foto. Ela aparece automaticamente no PDF da proposta.",
      },
      {
        question: "O sistema calcula o preço total automaticamente?",
        answer:
          "Sim. Ao adicionar itens com quantidade e preço unitário — ou com medidas e preço por m² —, o ProOps calcula o total da proposta e atualiza o financeiro automaticamente.",
      },
      {
        question: "Qual o custo para começar?",
        answer:
          "Há um plano gratuito para testar. Os planos pagos têm preço acessível para lojas de todos os portes.",
      },
    ],
    cta: {
      title: "Sua loja de decoração merece um sistema profissional",
      subtitle:
        "Junte-se a lojas de cortinas, persianas e papéis de parede que já usam o ProOps para fechar mais vendas com propostas profissionais.",
      crossLink: {
        label: "Ver também: ERP para Automação Residencial",
        href: "/automacao-residencial",
      },
    },
    seo: {
      metadataTitle:
        "ERP para Decoração — cortinas, persianas e papéis de parede",
      metadataDescription:
        "ProOps é o ERP para lojas de decoração. Propostas com cálculo automático de metros, CRM, financeiro e WhatsApp integrados.",
      breadcrumb: "Decoração",
    },
  },
};
