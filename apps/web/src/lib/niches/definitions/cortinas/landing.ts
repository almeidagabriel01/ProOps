import { Ruler, Layers, ArrowUpDown, LayoutGrid } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import type { ProdutoDeExemplo } from "@/lib/landing/proposta-de-exemplo";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Produtos de exemplo, com preço fictício, calculados pelo motor de preço real. */
const PERSIANA_ROLO: ProdutoDeExemplo = { price: 145, markup: 60, pricingModel: { mode: "curtain_meter" } };
const CORTINA_WAVE: ProdutoDeExemplo = {
  price: 0,
  markup: 0,
  pricingModel: {
    mode: "curtain_height",
    tiers: [
      { id: "ate-1-8", maxHeight: 1.8, basePrice: 120, markup: 70 },
      { id: "ate-2-6", maxHeight: 2.6, basePrice: 160, markup: 70 },
      { id: "ate-3-2", maxHeight: 3.2, basePrice: 210, markup: 70 },
    ],
  },
};
const BANDO: ProdutoDeExemplo = { price: 110, markup: 60, pricingModel: { mode: "curtain_width" } };

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "cortinas",
  acento: { claro: "#be185d", escuro: "#f9a8d4" },
  hero: {
    title: "ERP para",
    titleHighlight: "Persianas e Toldos",
    subtitle:
      "A ProOps tem um pacote pronto para empresas de persianas, cortinas, toldos e pergolados: proposta por ambiente com preço por medida, catálogo com fotos, obra, CRM e financeiro integrados.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("cortinas") },
    secondaryCta: { label: "Fazer login", href: "/login" },
    provas: ["Preço por m², faixa de altura e largura", "Proposta por ambiente", "Da medição à entrega"],
  },
  dores: [
    {
      antes: "Medida anotada no papel e a conta feita na calculadora, vão por vão.",
      depois: "Largura e altura entram na proposta, e o preço sai da regra do produto.",
    },
    {
      antes: "A tabela de faixas de altura numa planilha à parte, sempre desatualizada.",
      depois: "A faixa de cada cortina escolhida na própria linha da proposta.",
    },
    {
      antes: "Instalação marcada de cabeça, sem saber o que já chegou da fábrica.",
      depois: "Medição, produção, instalação e entrega com checklist e fotos.",
    },
  ],
  cena: {
    titulo: "O vão que vira preço",
    frase: "Arraste as medidas e troque o modo de cobrança: o total é o que a proposta calcularia.",
    dados: {
      tipo: "vao-persiana",
      largura: 2.4,
      altura: 1.8,
      produtos: {
        curtain_meter: { descricao: "Persiana rolô blackout", produto: PERSIANA_ROLO },
        curtain_height: { descricao: "Cortina wave em linho", produto: CORTINA_WAVE },
        curtain_width: { descricao: "Bandô com trilho", produto: BANDO },
      },
    },
  },
  modulesSection: {
    title: "Três modos de preço",
    titleHighlight: "por medida",
    subtitle:
      "Cada produto escolhe como é cobrado, e a proposta calcula o total a partir das medidas do vão.",
  },
  modules: [
    {
      icon: Ruler,
      title: "Por área (m²)",
      modo: "curtain_meter",
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
      modo: "curtain_height",
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
      modo: "curtain_width",
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
    title: "Da medição do vão ao toldo instalado",
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
