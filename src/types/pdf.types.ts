/**
 * Tipos canônicos para PDF de propostas.
 *
 * FONTE ÚNICA DA VERDADE: Todos os arquivos que precisam de `PdfSection`,
 * `CoverElement` ou `CoverElementPosition` devem importar daqui.
 *
 * Evita divergência de schema entre o editor de PDF, o template de renderização
 * e os componentes de visualização.
 */

// ---------------------------------------------------------------------------
// PdfSection — seções de conteúdo do corpo da proposta
// ---------------------------------------------------------------------------

export interface PdfSection {
  id: string;
  type: "title" | "text" | "image" | "divider" | "product-table";
  content: string;
  imageUrl?: string;
  /** Largura da coluna em percentagem (10–100) */
  columnWidth?: number;
  styles: {
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: "left" | "center" | "right";
    color?: string;
    backgroundColor?: string;
    padding?: string;
    marginTop?: string;
    marginBottom?: string;
    /** Largura da imagem em percentagem (10–100) */
    imageWidth?: number;
    imageAlign?: "left" | "center" | "right";
    imageBorderRadius?: string;
    /** Arredondamento de borda (para logo) */
    borderRadius?: number;
    imageBorder?: boolean;
    verticalAlign?: "top" | "center" | "bottom";
  };
}

// ---------------------------------------------------------------------------
// CoverElement — elementos posicionados livremente na capa
// ---------------------------------------------------------------------------

/** Posições pré-definidas de legado (mantidas para retrocompatibilidade) */
export type CoverElementPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface CoverElement {
  id: string;
  type:
    | "title"
    | "subtitle"
    | "text"
    | "label"
    | "divider"
    | "client-name"
    | "proposal-title"
    | "valid-until"
    | "logo"
    | "company-name"
    | "image";
  content: string;
  /** URL da imagem (para elementos do tipo "image") */
  imageUrl?: string;
  /** Texto exibido antes do conteúdo dinâmico */
  prefix?: string;
  /** Texto exibido após o conteúdo dinâmico */
  suffix?: string;
  /** Posição horizontal em percentagem (0–100) */
  x: number;
  /** Posição vertical em percentagem (0–100) */
  y: number;
  order: number;
  /** Se true, adiciona o nome do cliente após o conteúdo */
  includesClientName?: boolean;
  /** Se true, usa o título da proposta em vez de `content` */
  usesProposalTitle?: boolean;
  styles: {
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
    letterSpacing?: string;
    textAlign?: "left" | "center" | "right";
    color?: string;
    opacity?: number;
    marginTop?: string;
    marginBottom?: string;
    borderRadius?: string | number;
    /** Largura da imagem em percentagem (10–100) */
    imageWidth?: number;
    /** Altura da imagem em px */
    imageHeight?: number;
    imageFit?: "cover" | "contain";
    imageBorder?: boolean;
    /** Específico para divisores */
    width?: string;
    height?: string;
    backgroundColor?: string;
  };
}
