import * as React from "react";
import { ProposalSectionType } from "@/types";
import {
  Type,
  Table,
  Image as ImageIcon,
  List,
  Minus,
  Layers,
  GitBranch,
} from "lucide-react";
import { getNicheConfig } from "@/lib/niches/config";
import {
  cap,
  term,
  type NicheVocabulary,
  type Term,
} from "@/lib/niches/vocabulary";

export interface SectionTypeConfig {
  type: ProposalSectionType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

/**
 * Os dois níveis do campo hierárquico: o local e o grupo do nicho. Quando o
 * nicho usa o mesmo termo para os dois (persianas, em que cada grupo é o
 * próprio ambiente), o segundo nível vira "produto" para não repetir.
 */
export function hierarchicalFieldTerms(v: NicheVocabulary): {
  primary: Term;
  secondary: Term;
} {
  return {
    primary: v.place,
    secondary:
      v.group.plural === v.place.plural
        ? term("produto", "produtos", "m")
        : v.group,
  };
}

/** Tipos de seção com o rótulo do campo hierárquico no vocabulário do nicho. */
export function getSectionTypes(v: NicheVocabulary): SectionTypeConfig[] {
  const { primary, secondary } = hierarchicalFieldTerms(v);
  return buildSectionTypes(
    `${cap(primary.singular)} + ${cap(secondary.singular)}`,
  );
}

const buildSectionTypes = (hierarchicalLabel: string): SectionTypeConfig[] => [
  {
    type: "header",
    label: "Cabeçalho",
    icon: <Type className="w-4 h-4" />,
    description: "Título de seção",
  },
  {
    type: "text",
    label: "Texto",
    icon: <Type className="w-4 h-4" />,
    description: "Parágrafo de texto",
  },
  {
    type: "table",
    label: "Tabela",
    icon: <Table className="w-4 h-4" />,
    description: "Tabela de itens/preços",
  },
  {
    type: "image",
    label: "Imagem",
    icon: <ImageIcon className="w-4 h-4" />,
    description: "Upload de imagem",
  },
  {
    type: "list",
    label: "Lista",
    icon: <List className="w-4 h-4" />,
    description: "Lista de itens",
  },
  {
    type: "custom-field",
    label: "Campo Simples",
    icon: <Layers className="w-4 h-4" />,
    description: "Campo único",
  },
  {
    type: "hierarchical-field",
    label: hierarchicalLabel,
    icon: <GitBranch className="w-4 h-4" />,
    description: "Campos vinculados",
  },
  {
    type: "separator",
    label: "Separador",
    icon: <Minus className="w-4 h-4" />,
    description: "Linha divisória",
  },
];

/** Os tipos no vocabulário do nicho padrão; na tela, use `getSectionTypes`. */
export const sectionTypes: SectionTypeConfig[] = getSectionTypes(
  getNicheConfig(null).vocabulary,
);

export interface TableItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface ParsedContent {
  text?: string;
  data?: string; // Base64 image data
  url?: string; // Legacy URL support
  caption?: string;
  items?: string[] | TableItem[];
  showTotal?: boolean;
  fieldTypeId?: string;
  selectedItems?: string[];
  // Hierarchical fields
  environmentTypeId?: string;
  systemTypeId?: string;
  entries?: { id: string; environmentItemId: string; systemItems: string[] }[];
}

export function getDefaultTitle(
  type: ProposalSectionType,
  vocabulary: NicheVocabulary = getNicheConfig(null).vocabulary,
): string {
  const { primary, secondary } = hierarchicalFieldTerms(vocabulary);
  const titles: Record<ProposalSectionType, string> = {
    header: "Título",
    text: "Descrição",
    table: "Itens e Valores",
    image: "Imagem",
    list: "Lista",
    "custom-field": "Campo Personalizado",
    "hierarchical-field": `${cap(primary.plural)} e ${cap(secondary.plural)}`,
    "product-table": "Tabela de Produtos",
    separator: "",
  };
  return titles[type];
}

export function getDefaultContent(type: ProposalSectionType): string {
  const defaults: Record<ProposalSectionType, object> = {
    header: { text: "" },
    text: { text: "" },
    table: { items: [], showTotal: true },
    image: { data: "", caption: "" },
    list: { items: [""] },
    "custom-field": { fieldTypeId: "", selectedItems: [] },
    "hierarchical-field": {
      environmentTypeId: "",
      systemTypeId: "",
      entries: [],
    },
    "product-table": { products: [] },
    separator: {},
  };
  return JSON.stringify(defaults[type]);
}

export function parseContent(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}
