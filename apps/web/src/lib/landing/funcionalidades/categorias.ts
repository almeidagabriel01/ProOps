import {
  Bot,
  Boxes,
  FileSignature,
  HardHat,
  Landmark,
  Link2,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { Categoria, CategoriaId } from "./tipos";

/**
 * As áreas do ERP, na ordem em que uma venda de projeto passa por elas: o
 * contato vira proposta, a proposta vira obra e parcela, a parcela vira nota e
 * relatório do contador. A página de funcionalidades segue essa ordem, e o
 * mapa do topo desenha uma linha por área.
 */
export const CATEGORIAS: readonly Categoria[] = [
  {
    id: "relacionamento",
    titulo: "CRM e clientes",
    resumo: "Do primeiro contato ao cliente cadastrado, com o histórico de cada conversa.",
    icone: Users,
  },
  {
    id: "vendas",
    titulo: "Propostas e vendas",
    resumo: "A proposta que o cliente abre, entende e aceita pelo link.",
    icone: FileSignature,
  },
  {
    id: "catalogo",
    titulo: "Catálogo e nichos",
    resumo: "Produtos, serviços e pacotes prontos, no preço e na medida do seu segmento.",
    icone: Boxes,
  },
  {
    id: "obra",
    titulo: "Obra e agenda",
    resumo: "A instalação etapa por etapa, com visita marcada e entrega aceita pelo cliente.",
    icone: HardHat,
  },
  {
    id: "links",
    titulo: "Pós-venda por link",
    resumo: "O que o cliente e o contador abrem sem senha: proposta, parcela, obra, portal.",
    icone: Link2,
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    resumo: "Parcelas nascidas da venda, carteiras, comissões, DRE e o caixa dos próximos meses.",
    icone: Landmark,
  },
  {
    id: "fiscal",
    titulo: "Notas fiscais",
    resumo: "NF-e e NFS-e emitidas da proposta ou do lançamento, com PDF e XML guardados.",
    icone: Receipt,
  },
  {
    id: "lia",
    titulo: "Lia, a IA",
    resumo: "Uma assistente que responde sobre o seu negócio e faz o trabalho, com a sua confirmação.",
    icone: Bot,
  },
  {
    id: "plataforma",
    titulo: "Equipe e segurança",
    resumo: "Quem vê o quê, login em duas etapas e as integrações que ligam tudo.",
    icone: ShieldCheck,
  },
];

export function categoria(id: CategoriaId): Categoria {
  const encontrada = CATEGORIAS.find((c) => c.id === id);
  if (!encontrada) throw new Error(`Categoria desconhecida: ${id}`);
  return encontrada;
}
