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
import type { TenantNiche } from "@/types";
import { signupHrefForNiche } from "@/lib/niches/niche-ids";

export const NICHE_LANDING_CONFIG: Record<TenantNiche, NicheLandingConfig> = {
  automacao_residencial: {
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
        href: "/decoracao",
      },
    },
    seo: {
      metadataTitle:
        "ERP para Automação Residencial: propostas, projetos e gestão",
      metadataDescription:
        "ProOps para empresas de automação residencial: pacote pronto com propostas em PDF, CRM, financeiro, agenda e WhatsApp. ERP que adapta-se ao seu negócio.",
      breadcrumb: "Automação Residencial",
    },
  },

  cortinas: {
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
        href: "/automacao-residencial",
      },
    },
    seo: {
      metadataTitle: "ERP para Persianas e Toldos: propostas por medida e gestão",
      metadataDescription:
        "ProOps para empresas de persianas, cortinas e toldos: preço por m², por largura ou por faixa de altura, proposta por ambiente, obra, CRM e financeiro.",
      breadcrumb: "Persianas e Toldos",
    },
  },
};
