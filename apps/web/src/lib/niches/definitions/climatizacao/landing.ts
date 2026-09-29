import { Package, Ruler, Snowflake } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import type { ProdutoDeExemplo } from "@/lib/landing/proposta-de-exemplo";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Produtos de exemplo, com preço fictício, calculados pelo motor de preço real. */
const porUnidade = (price: number, markup: number): ProdutoDeExemplo => ({
  price,
  markup,
  pricingModel: { mode: "standard" },
});
const TUBULACAO: ProdutoDeExemplo = { price: 85, markup: 40, pricingModel: { mode: "curtain_width" } };

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "climatizacao",
  acento: { claro: "#1e40af", escuro: "#93c5fd" },
  hero: {
    title: "ERP para",
    titleHighlight: "Climatização e Ar-Condicionado",
    subtitle:
      "A ProOps tem um pacote pronto para empresas de climatização: orçamento com o aparelho, a tubulação pelo comprimento e a instalação, proposta por ambiente, visita técnica pelo link, obra da vistoria ao start-up, CRM e financeiro integrados.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("climatizacao") },
    secondaryCta: { label: "Fazer login", href: "/login" },
    provas: ["Aparelho, tubulação e instalação", "Proposta por ambiente", "Da vistoria ao start-up"],
  },
  dores: [
    {
      antes: "Metros de tubulação somados na calculadora e passados à mão para o orçamento.",
      depois: "A tubulação entra pelo comprimento, e o preço sai da regra do produto.",
    },
    {
      antes: "Um orçamento por aparelho, refeito a cada ambiente que o cliente acrescenta.",
      depois: "Sala, suítes e escritório na mesma proposta, cada um com o seu aparelho.",
    },
    {
      antes: "Vácuo, carga de gás e testes combinados pelo WhatsApp, sem registro.",
      depois: "Vistoria, infraestrutura, instalação, testes e entrega com checklist e fotos.",
    },
  ],
  cena: {
    titulo: "Do aparelho ao orçamento",
    frase: "Escolha a capacidade e o comprimento da tubulação e veja cada item entrar na proposta com a sua regra de preço.",
    dados: {
      tipo: "split-instalacao",
      aparelhos: [
        { btus: 9000, descricao: "Split inverter 9.000 BTUs", produto: porUnidade(1650, 30) },
        { btus: 12000, descricao: "Split inverter 12.000 BTUs", produto: porUnidade(1990, 30) },
        { btus: 18000, descricao: "Split inverter 18.000 BTUs", produto: porUnidade(2890, 30) },
        { btus: 24000, descricao: "Split inverter 24.000 BTUs", produto: porUnidade(3790, 30) },
      ],
      tubulacao: { descricao: "Tubulação de cobre com isolamento", produto: TUBULACAO, comprimento: 5 },
      instalacao: { descricao: "Instalação com vácuo e carga de gás", produto: porUnidade(450, 30) },
    },
  },
  modulesSection: {
    title: "Da vistoria ao",
    titleHighlight: "orçamento aprovado",
    subtitle:
      "Cada produto escolhe como é cobrado, e a proposta calcula o total com o que a sua equipe levantou na vistoria.",
  },
  modules: [
    {
      icon: Snowflake,
      title: "Por unidade",
      modo: "standard",
      description:
        "O aparelho, o kit de instalação, o suporte e a mão de obra como item fechado, com o estoque controlado no catálogo.",
      bullets: ["Split, cassete, piso-teto e multi-split", "Kit e suporte por peça", "Instalação na mesma proposta"],
    },
    {
      icon: Ruler,
      title: "Por metro",
      modo: "curtain_width",
      description:
        "Preço por metro, multiplicado pelo comprimento. Para tubulação de cobre, cabo de interligação e dreno.",
      bullets: ["Comprimento em metros", "Custo e markup próprios", "Vários trechos no mesmo ambiente"],
    },
  ],
  faq: [
    {
      question: "A ProOps funciona para empresa de climatização e ar-condicionado?",
      answer:
        "Sim. O pacote de climatização já vem com o aparelho e a instalação por unidade, a tubulação pelo comprimento, proposta por ambiente e etapas de obra da vistoria ao start-up.",
    },
    {
      question: "A ProOps faz PMOC e contrato de manutenção?",
      answer:
        "Contrato de manutenção, sim: a mensalidade entra no financeiro sozinha todo mês, com o link de Pix ou boleto e a nota de serviço quando é paga, e a visita preventiva abre a ordem de serviço com o técnico e o checklist. O PMOC, com o plano e o relatório que a norma pede, está em desenvolvimento.",
    },
    {
      question: "A ProOps calcula a carga térmica do ambiente?",
      answer:
        "Não. A capacidade de cada aparelho é definida pela sua equipe na vistoria. A ProOps monta o orçamento com o aparelho escolhido, a tubulação e a instalação.",
    },
    {
      question: "Qual o custo para começar?",
      answer:
        "Você cria uma conta gratuita e navega a ProOps em modo demonstração, com dados de exemplo de climatização, antes de assinar.",
    },
  ],
  cta: {
    title: "Sua empresa de climatização merece um sistema profissional",
    subtitle: "Orçamentos rápidos, obra organizada e financeiro em dia, em um só lugar.",
    crossLink: {
      label: "Ver também: ERP para Segurança Eletrônica",
      href: NICHE_REGISTRY.seguranca_eletronica.landingPath,
    },
  },
  seo: {
    metadataTitle: "ERP para Climatização e Ar-Condicionado: orçamento e gestão",
    metadataDescription:
      "ProOps para empresas de climatização e ar-condicionado: orçamento com aparelho, tubulação por metro e instalação, proposta por ambiente, obra, CRM e financeiro.",
    breadcrumb: "Climatização e Ar-Condicionado",
    keywords: [
      "sistema para empresa de ar condicionado",
      "ERP climatização",
      "orçamento de instalação de ar condicionado",
      "software para climatização",
      "sistema gestão refrigeração",
    ],
    ogTitle: "ERP para Climatização e Ar-Condicionado | ProOps",
    ogDescription:
      "Orçamento com aparelho, tubulação e instalação, proposta por ambiente, obra, CRM e financeiro para empresas de climatização.",
  },
  gallery: {
    icon: Package,
    eyebrow: "Pacote pronto",
    title: "Climatização e Ar-Condicionado",
    description:
      "Aparelho e instalação por unidade, tubulação pelo comprimento, proposta por ambiente e obra da vistoria ao start-up.",
    features: ["Aparelho, tubulação e instalação", "Proposta por ambiente", "Obra da vistoria ao start-up"],
  },
};
