import { Ruler, LayoutGrid, Package } from "lucide-react";
import type { NicheLandingConfig } from "@/components/landing/niche/types";
import type { ProdutoDeExemplo } from "@/lib/landing/proposta-de-exemplo";
import { NICHE_REGISTRY } from "../../registry";
import { signupHrefForNiche } from "../../niche-ids";

/** Produtos de exemplo, com preço fictício, calculados pelo motor de preço real. */
const ROUPEIRO: ProdutoDeExemplo = { price: 780, markup: 45, pricingModel: { mode: "curtain_meter" } };
const ARMARIO_LINEAR: ProdutoDeExemplo = { price: 1150, markup: 45, pricingModel: { mode: "curtain_width" } };
const AEREO: ProdutoDeExemplo = { price: 820, markup: 45, pricingModel: { mode: "curtain_width" } };
const PUXADOR: ProdutoDeExemplo = { price: 38, markup: 60, pricingModel: { mode: "standard" } };
const MONTAGEM: ProdutoDeExemplo = { price: 850, markup: 0, pricingModel: { mode: "standard" } };

/** Texto da landing do nicho. */
export const nicheLanding: NicheLandingConfig = {
  slug: "marcenaria",
  acento: { claro: "#8a5a2b", escuro: "#d6a574" },
  hero: {
    title: "ERP para",
    titleHighlight: "Marcenaria e Móveis Planejados",
    subtitle:
      "A ProOps tem um pacote pronto para marcenarias e lojas de móveis planejados: orçamento por m² ou por metro linear, proposta por ambiente, agenda de medição, obra do projeto à montagem, CRM e financeiro integrados.",
    primaryCta: { label: "Começar agora", href: signupHrefForNiche("marcenaria") },
    secondaryCta: { label: "Fazer login", href: "/login" },
    provas: ["Por m², metro linear e unidade", "Proposta por ambiente", "Da medição à montagem"],
  },
  dores: [
    {
      antes: "Valor do projeto passado à mão do programa de desenho para a proposta.",
      depois: "Cada peça entra com a medida dela, e o preço sai da regra do produto.",
    },
    {
      antes: "Metro linear da cozinha numa planilha, m² do roupeiro em outra.",
      depois: "Por m², por metro linear e por unidade na mesma proposta.",
    },
    {
      antes: "Produção e montagem acompanhadas pelo telefone, peça por peça.",
      depois: "Medição, projeto, produção, montagem e entrega com checklist e fotos.",
    },
  ],
  propostaExemplo: {
    titulo: "Cozinha e dormitório planejados",
    cliente: "Júlia Prado",
    grupos: [
      {
        nome: "Cozinha",
        itens: [
          { descricao: "Armário inferior com bancada", produto: ARMARIO_LINEAR, medidas: { largura: 3.2 } },
          { descricao: "Armário aéreo", produto: AEREO, medidas: { largura: 2.6 } },
          { descricao: "Puxador perfil em alumínio", produto: PUXADOR, quantidade: 10 },
        ],
      },
      {
        nome: "Dormitório",
        itens: [
          { descricao: "Roupeiro de correr em MDF", produto: ROUPEIRO, medidas: { largura: 2.4, altura: 2.6 } },
          { descricao: "Painel de TV", produto: ROUPEIRO, medidas: { largura: 1.8, altura: 1.2 } },
        ],
      },
      {
        nome: "Closet",
        itens: [{ descricao: "Montagem no local", produto: MONTAGEM, quantidade: 1 }],
      },
    ],
  },
  cena: {
    titulo: "Do módulo ao orçamento",
    frase: "Mude as medidas do ambiente e veja cada peça entrar na proposta com a sua regra de preço.",
    dados: {
      tipo: "modulo-planejado",
      roupeiro: { descricao: "Roupeiro em MDF, frente", produto: ROUPEIRO, largura: 2.4, altura: 2.6 },
      bancada: { descricao: "Armário inferior com bancada", produto: ARMARIO_LINEAR, largura: 3.2 },
      puxadores: { descricao: "Puxador perfil em alumínio", produto: PUXADOR, quantidade: 8 },
    },
  },
  modulesSection: {
    title: "Do ambiente medido ao orçamento aprovado",
    subtitle:
      "Cada produto escolhe como é cobrado, e a proposta calcula o total a partir das medidas que a sua equipe tirou no local.",
  },
  modules: [
    {
      icon: Ruler,
      title: "Por m²",
      modo: "curtain_meter",
      description:
        "Largura x altura x preço do m². Para armários, painéis, portas e roupeiros cobrados pela área de frente.",
      bullets: ["Largura e altura em metros", "Mais de uma peça no mesmo ambiente", "Markup configurável por produto"],
    },
    {
      icon: LayoutGrid,
      title: "Por metro linear",
      modo: "curtain_width",
      description:
        "Preço por metro, multiplicado pela largura. Para armários de cozinha, bancadas, rodapés e prateleiras.",
      bullets: ["Largura em metros", "Várias peças no mesmo ambiente", "Custo e markup próprios"],
    },
    {
      icon: Package,
      title: "Por unidade",
      modo: "standard",
      description:
        "Ferragens, puxadores, iluminação e a montagem como item fechado, ao lado dos móveis cobrados por medida.",
      bullets: ["Kit e acessório por peça", "Serviço de montagem na mesma proposta", "Estoque controlado no catálogo"],
    },
  ],
  faq: [
    {
      question: "A ProOps funciona para marcenaria e loja de móveis planejados?",
      answer:
        "Sim. O pacote de marcenaria e móveis planejados já vem com orçamento por m² e por metro linear, proposta por ambiente e etapas de obra da medição à montagem.",
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
        "Você cria uma conta gratuita e navega a ProOps em modo demonstração, com dados de exemplo de marcenaria, antes de assinar.",
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
    metadataTitle: "ERP para Marcenaria e Móveis Planejados: orçamento por medida e gestão",
    metadataDescription:
      "ProOps para marcenarias e lojas de móveis planejados: orçamento por m² e por metro linear, proposta por ambiente, obra, CRM e financeiro.",
    breadcrumb: "Marcenaria e Móveis Planejados",
    keywords: [
      "sistema para marcenaria",
      "ERP marcenaria e móveis planejados",
      "orçamento de móveis planejados",
      "software para marcenaria",
      "sistema gestão marcenaria",
    ],
    ogTitle: "ERP para Marcenaria e Móveis Planejados | ProOps",
    ogDescription:
      "Orçamento por medida, proposta por ambiente, obra, CRM e financeiro para marcenarias e lojas de móveis planejados.",
  },
  gallery: {
    icon: LayoutGrid,
    eyebrow: "Pacote pronto",
    title: "Marcenaria e Móveis Planejados",
    description:
      "Orçamento por m² e por metro linear, proposta por ambiente e obra do projeto à montagem.",
    features: ["Orçamento por medida", "Proposta por ambiente", "Obra do projeto à montagem"],
  },
};
