import type React from "react";

import type { ItemDeExemplo, ProdutoDeExemplo } from "@/lib/landing/proposta-de-exemplo";
import type { ProductPricingMode } from "@/lib/product-pricing";
import type { TenantNiche } from "@/types";

/**
 * A landing de um nicho, inteira como DADO: o template (`niche-landing-page`)
 * é um só, e o que faz a página de persianas ser diferente da de segurança é o
 * que está aqui. Um campo novo obrigatório faz o compilador cobrar cada nicho,
 * inclusive o próximo.
 *
 * Tudo o que chega às ilhas de cliente é serializável (sem ícone, sem função):
 * a cena de cada nicho é um componente de cliente e recebe `cena` e `modules`
 * pela fronteira do servidor.
 */

/** Um item de um modo de preço na cena: o nome que vai na proposta e o produto. */
export interface ItemDaCena {
  descricao: string;
  produto: ProdutoDeExemplo;
}

/**
 * A cena de assinatura de cada nicho. União discriminada por `tipo`, e o mapa
 * de cenas (`cenas/index.ts`) é um `Record` desse `tipo`: um nicho novo
 * escolhe uma cena que existe ou declara a sua.
 */
export type CenaDoNicho =
  | {
      tipo: "vao-persiana";
      /** Medidas com que a cena abre, em metros. */
      largura: number;
      altura: number;
      /** Um produto por modo de preço vendido pelo nicho. */
      produtos: Partial<Record<Exclude<ProductPricingMode, "standard">, ItemDaCena>>;
    }
  | {
      tipo: "esquadria";
      largura: number;
      altura: number;
      folhas: number;
      /** Vidro (m²), perfil (metro linear) e ferragem (unidade). */
      vidro: ItemDaCena;
      perfil: ItemDaCena;
      ferragem: ItemDaCena & { quantidade: number };
    }
  | {
      tipo: "modulo-planejado";
      /** O roupeiro (m² de frente), a bancada (metro linear) e os puxadores (unidade). */
      roupeiro: ItemDaCena & { largura: number; altura: number };
      bancada: ItemDaCena & { largura: number };
      puxadores: ItemDaCena & { quantidade: number };
    }
  | {
      tipo: "planta-seguranca";
      /** As áreas da planta, em coordenadas de 0 a 100. */
      areas: readonly { nome: string; x: number; y: number; w: number; h: number }[];
      sistemas: readonly {
        nome: string;
        dispositivos: readonly {
          tipo: "camera" | "sensor" | "leitor";
          x: number;
          y: number;
          /** Para onde a câmera olha, em graus (0 = direita). */
          angulo?: number;
        }[];
        itens: readonly ItemDeExemplo[];
      }[];
      /** O contrato mensal, que vira lançamento recorrente. */
      mensalidade: { descricao: string; valor: number };
    }
  | {
      tipo: "matriz-automacao";
      /** Os ambientes da planta, em coordenadas de 0 a 100. */
      ambientes: readonly { nome: string; x: number; y: number; w: number; h: number }[];
      sistemas: readonly { nome: string; glifo: "luz" | "som" | "rede" | "persiana"; item: ItemDeExemplo }[];
      /** Células ligadas quando a cena abre: [ambiente, sistema]. */
      inicial: readonly (readonly [number, number])[];
    };

export interface NicheLandingConfig {
  slug: TenantNiche;
  /**
   * A cor do nicho sobre a base preto e branco da ProOps: o termo em destaque
   * do título, os traços das cenas, a linha das etapas. Botão e texto
   * continuam na tinta da página. Hex, porque o teste de contraste lê.
   */
  acento: { claro: string; escuro: string };
  hero: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
    /** Três fatos curtos do nicho, embaixo dos botões. */
    provas: readonly string[];
  };
  /** O jeito antigo e o jeito na ProOps, lado a lado. */
  dores: readonly { antes: string; depois: string }[];
  cena: { titulo: string; frase: string; dados: CenaDoNicho };
  /** `titleHighlight` fecha o título no itálico de acento, como nas outras seções. */
  modulesSection: { title: string; titleHighlight: string; subtitle: string };
  modules: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    bullets: string[];
    /** O modo de preço que o módulo vende, quando ele é um. Liga o módulo à aba da cena. */
    modo?: ProductPricingMode;
  }[];
  faq: { question: string; answer: string }[];
  cta: {
    title: string;
    subtitle: string;
    crossLink: { label: string; href: string };
  };
  seo: {
    metadataTitle: string;
    metadataDescription: string;
    breadcrumb: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
  };
  /** Cartão do nicho na galeria de pacotes da home do ERP. */
  gallery: {
    icon: React.ComponentType<{ className?: string }>;
    eyebrow: string;
    title: string;
    description: string;
    features: string[];
  };
}
