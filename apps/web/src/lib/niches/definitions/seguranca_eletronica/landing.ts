import { Layers, ShieldCheck, Repeat } from "lucide-react";
import type { CenaDoNicho, NicheLandingConfig } from "@/components/landing/niche/types";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/**
 * Os sistemas de exemplo, com preço fictício: a mesma lista abastece a planta
 * da cena e a proposta da tela do herói.
 */
const SISTEMAS: Extract<CenaDoNicho, { tipo: "planta-seguranca" }>["sistemas"] = [
  {
    nome: "CFTV",
    dispositivos: [
      { tipo: "camera", x: 6, y: 6, angulo: 40 },
      { tipo: "camera", x: 94, y: 6, angulo: 140 },
      { tipo: "camera", x: 8, y: 50, angulo: 20 },
      { tipo: "camera", x: 92, y: 50, angulo: 160 },
    ],
    itens: [
      { descricao: "Câmera bullet Full HD", produto: { price: 280, markup: 60, pricingModel: { mode: "standard" } }, quantidade: 4 },
      { descricao: "Gravador de 8 canais", produto: { price: 890, markup: 40, pricingModel: { mode: "standard" } }, quantidade: 1 },
      { descricao: "Instalação do CFTV", produto: { price: 1200, markup: 0, pricingModel: { mode: "standard" } }, quantidade: 1 },
    ],
  },
  {
    nome: "Alarme",
    dispositivos: [
      { tipo: "sensor", x: 30, y: 12 },
      { tipo: "sensor", x: 70, y: 12 },
      { tipo: "sensor", x: 50, y: 38 },
    ],
    itens: [
      { descricao: "Central de alarme", produto: { price: 520, markup: 50, pricingModel: { mode: "standard" } }, quantidade: 1 },
      { descricao: "Sensor infravermelho", produto: { price: 65, markup: 70, pricingModel: { mode: "standard" } }, quantidade: 6 },
    ],
  },
  {
    nome: "Controle de acesso",
    dispositivos: [{ tipo: "leitor", x: 17, y: 60 }],
    itens: [
      { descricao: "Leitor facial", produto: { price: 1450, markup: 40, pricingModel: { mode: "standard" } }, quantidade: 1 },
      { descricao: "Fechadura eletroímã", produto: { price: 380, markup: 50, pricingModel: { mode: "standard" } }, quantidade: 1 },
    ],
  },
];

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "seguranca_eletronica",
  acento: { claro: "#dc2626", escuro: "#f87171" },
  hero: {
    title: "ERP para",
    titleHighlight: "Segurança Eletrônica",
    subtitle:
      "A ProOps tem um pacote pronto para instaladores e integradores de CFTV, alarme, controle de acesso e cerca elétrica: proposta por sistema e área, obra por etapas, CRM e financeiro integrados.",
    primaryCta: {
      label: "Começar agora",
      href: signupHrefForNiche("seguranca_eletronica"),
    },
    secondaryCta: { label: "Fazer login", href: "/login" },
    provas: ["Sistemas por área", "Contrato mensal recorrente", "Do levantamento à entrega"],
  },
  dores: [
    {
      antes: "Kit de câmeras montado do zero a cada orçamento.",
      depois: "Sistemas prontos, com produto e mão de obra juntos, reaproveitados em toda proposta.",
    },
    {
      antes: "Mensalidade de monitoramento lembrada de cabeça todo mês.",
      depois: "O contrato de monitoramento lança a mensalidade sozinho todo mês, com o link de Pix ou boleto.",
    },
    {
      antes: "Vistoria, instalação e senhas entregues sem registro nenhum.",
      depois: "Levantamento, instalação, configuração e entrega com checklist e fotos.",
    },
  ],
  cena: {
    titulo: "Cada área coberta, cada mês cobrado",
    frase: "Ligue os sistemas na planta: cada um entra na proposta com os itens dele, e a mensalidade vira contrato.",
    dados: {
      tipo: "planta-seguranca",
      areas: [
        { nome: "Perímetro", x: 0, y: 0, w: 100, h: 70 },
        { nome: "Portaria", x: 4, y: 46, w: 26, h: 20 },
        { nome: "Garagem", x: 34, y: 46, w: 62, h: 20 },
      ],
      sistemas: SISTEMAS,
      mensalidade: { descricao: "Monitoramento e manutenção preventiva", valor: 189 },
    },
  },
  modulesSection: {
    title: "Feito para quem",
    titleHighlight: "instala e integra",
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
        "Monitoramento e manutenção com a mensalidade lançada sozinha todo mês e a visita preventiva agendada.",
      bullets: [
        "Mensalidade no financeiro todo mês, sem digitar",
        "Cobrança por Pix ou boleto no link, com o pagamento online",
        "Nota de serviço emitida quando a mensalidade é paga, com o módulo fiscal",
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
        "Sim. O contrato de monitoramento ou manutenção lança a mensalidade no financeiro todo mês, e a visita preventiva abre a ordem de serviço sozinha.",
    },
    {
      question: "Qual o custo para começar?",
      answer:
        "Você cria uma conta gratuita e navega a ProOps em modo demonstração, com dados de exemplo de segurança eletrônica, antes de assinar.",
    },
  ],
  cta: {
    title: "Do levantamento ao contrato mensal",
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
