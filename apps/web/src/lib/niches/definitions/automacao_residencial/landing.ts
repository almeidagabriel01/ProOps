import { FileText, Package, Layers, Cpu } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import type { ProdutoDeExemplo } from "@/lib/landing/proposta-de-exemplo";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Produtos de exemplo, com preço fictício, calculados pelo motor de preço real. */
const ILUMINACAO: ProdutoDeExemplo = { price: 320, markup: 60, pricingModel: { mode: "standard" } };
const AUDIO: ProdutoDeExemplo = { price: 890, markup: 55, pricingModel: { mode: "standard" } };
const WIFI: ProdutoDeExemplo = { price: 620, markup: 50, pricingModel: { mode: "standard" } };
const MOTOR_PERSIANA: ProdutoDeExemplo = { price: 690, markup: 45, pricingModel: { mode: "standard" } };

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "automacao_residencial",
  acento: { claro: "#4f46e5", escuro: "#a5b4fc" },
  hero: {
    title: "ERP para",
    titleHighlight: "Automação Residencial",
    subtitle:
      "A ProOps tem um pacote pronto para integradores e empresas de automação residencial: gestão de propostas, CRM, financeiro e agenda integrados em um só lugar.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("automacao_residencial") },
    secondaryCta: { label: "Fazer login", href: "/login" },
    provas: ["Soluções por ambiente", "PDF com a sua marca", "Da infraestrutura à entrega"],
  },
  dores: [
    {
      antes: "Projeto por cômodo montado numa planilha que só você entende.",
      depois: "Soluções prontas por ambiente, reaproveitadas de proposta em proposta.",
    },
    {
      antes: "PDF refeito no editor de texto a cada mudança do cliente.",
      depois: "O PDF sai com a sua marca, e o cliente pede os ajustes pelo link.",
    },
    {
      antes: "Programação e entrega combinadas por mensagem, sem registro.",
      depois: "Infraestrutura, instalação, configuração e entrega com checklist e fotos.",
    },
  ],
  propostaExemplo: {
    titulo: "Automação do apartamento 1204",
    cliente: "Ana Moreira",
    grupos: [
      {
        nome: "Iluminação",
        itens: [
          { descricao: "Sala: módulo de iluminação", produto: ILUMINACAO, quantidade: 3 },
          { descricao: "Quarto: módulo de iluminação", produto: ILUMINACAO, quantidade: 2 },
        ],
      },
      {
        nome: "Áudio",
        itens: [{ descricao: "Sala: caixas de som embutidas (par)", produto: AUDIO, quantidade: 1 }],
      },
      {
        nome: "Wi-Fi",
        itens: [{ descricao: "Pontos de acesso mesh", produto: WIFI, quantidade: 3 }],
      },
    ],
  },
  cena: {
    titulo: "Ambiente por ambiente, sistema por sistema",
    frase: "Ligue os sistemas em cada cômodo: a planta mostra onde, e a proposta se agrupa sozinha.",
    dados: {
      tipo: "matriz-automacao",
      ambientes: [
        { nome: "Sala", x: 2, y: 2, w: 58, h: 40 },
        { nome: "Quarto", x: 62, y: 2, w: 36, h: 40 },
        { nome: "Cozinha", x: 2, y: 44, w: 96, h: 24 },
      ],
      sistemas: [
        { nome: "Iluminação", glifo: "luz", item: { descricao: "Módulo de iluminação", produto: ILUMINACAO, quantidade: 2 } },
        { nome: "Áudio", glifo: "som", item: { descricao: "Caixas de som embutidas (par)", produto: AUDIO, quantidade: 1 } },
        { nome: "Wi-Fi", glifo: "rede", item: { descricao: "Ponto de acesso mesh", produto: WIFI, quantidade: 1 } },
        { nome: "Persianas", glifo: "persiana", item: { descricao: "Motor para persiana", produto: MOTOR_PERSIANA, quantidade: 1 } },
      ],
      inicial: [
        [0, 0],
        [0, 1],
        [1, 0],
        [2, 2],
      ],
    },
  },
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
    title: "Venda o projeto inteiro, cômodo por cômodo",
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
