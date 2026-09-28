import { Ruler, LayoutGrid, Package } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import type { ProdutoDeExemplo } from "@/lib/landing/proposta-de-exemplo";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Produtos de exemplo, com preço fictício, calculados pelo motor de preço real. */
const VIDRO: ProdutoDeExemplo = { price: 185, markup: 55, pricingModel: { mode: "curtain_meter" } };
const PERFIL: ProdutoDeExemplo = { price: 95, markup: 60, pricingModel: { mode: "curtain_width" } };
const KIT: ProdutoDeExemplo = { price: 160, markup: 50, pricingModel: { mode: "standard" } };

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "vidracaria_esquadrias",
  acento: { claro: "#0e7490", escuro: "#67e8f9" },
  hero: {
    title: "ERP para",
    titleHighlight: "Vidraçaria e Esquadrias",
    subtitle:
      "A ProOps tem um pacote pronto para vidraçarias e empresas de esquadrias: orçamento por m² a partir das medidas do vão, proposta por ambiente, agenda de medição, obra da têmpera à instalação, CRM e financeiro integrados.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("vidracaria_esquadrias") },
    secondaryCta: { label: "Fazer login", href: "/login" },
    provas: ["Por m², metro linear e unidade", "Proposta por ambiente", "Da medição à entrega"],
  },
  dores: [
    {
      antes: "Vão medido na obra e orçamento montado à noite, no computador de casa.",
      depois: "As medidas entram na proposta e o total sai na hora, com o markup de cada produto.",
    },
    {
      antes: "Vidro por m², perfil por metro e kit por peça em três contas separadas.",
      depois: "Os três modos de preço na mesma proposta, cada item com a sua regra.",
    },
    {
      antes: "Têmpera e instalação acompanhadas no grupo do WhatsApp.",
      depois: "Medição, produção, instalação e entrega com checklist e fotos da obra.",
    },
  ],
  propostaExemplo: {
    titulo: "Box, sacada e janelas do apartamento 802",
    cliente: "Rafael Souza",
    grupos: [
      {
        nome: "Banheiro",
        itens: [
          { descricao: "Box de vidro temperado 8 mm", produto: VIDRO, medidas: { largura: 1.2, altura: 1.9 } },
          { descricao: "Kit de box com roldanas", produto: KIT, quantidade: 1 },
        ],
      },
      {
        nome: "Sacada",
        itens: [
          { descricao: "Envidraçamento de sacada", produto: VIDRO, medidas: { largura: 3.6, altura: 2.4 } },
          { descricao: "Trilho superior e inferior", produto: PERFIL, medidas: { largura: 3.6, paineis: 2 } },
        ],
      },
      {
        nome: "Fachada",
        itens: [
          { descricao: "Janela de correr, 2 folhas", produto: VIDRO, medidas: { largura: 2, altura: 1.2 } },
          { descricao: "Perfil de alumínio do requadro", produto: PERFIL, medidas: { largura: 6.4 } },
        ],
      },
    ],
  },
  cena: {
    titulo: "Medida que vira orçamento",
    frase: "Mude o vão e escolha o que olhar: o vidro por m², o perfil por metro linear, as ferragens por peça.",
    dados: {
      tipo: "esquadria",
      largura: 2,
      altura: 1.2,
      folhas: 2,
      vidro: { descricao: "Vidro temperado 8 mm incolor", produto: VIDRO },
      perfil: { descricao: "Perfil de alumínio, pelo perímetro", produto: PERFIL },
      ferragem: { descricao: "Kit de roldanas e fecho", produto: KIT, quantidade: 1 },
    },
  },
  modulesSection: {
    title: "Do vão medido ao",
    titleHighlight: "orçamento aprovado",
    subtitle:
      "Cada produto escolhe como é cobrado, e a proposta calcula o total a partir das medidas que a sua equipe tirou na obra.",
  },
  modules: [
    {
      icon: Ruler,
      title: "Por m²",
      modo: "curtain_meter",
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
      modo: "curtain_width",
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
      modo: "standard",
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
    title: "Do vão medido ao vidro instalado",
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
