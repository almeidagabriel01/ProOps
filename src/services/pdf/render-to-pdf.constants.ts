export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const DEFAULT_SCALE = 2;
export const FORCED_HTML2CANVAS_SCALE = 1.5;
export const FONT_READY_TIMEOUT_MS = 8000;
export const IMAGE_DECODE_TIMEOUT_MS = 10000;

export const CAPTURE_MODE_CLASS = "pdf-capture-mode";
export const CAPTURE_TARGET_ATTR = "data-pdf-capture-target";
export const TRANSPARENT_PIXEL_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";
export const CAPTURE_FONT_VARIABLES = [
  "--font-pdf-inter",
  "--font-pdf-roboto",
  "--font-pdf-lato",
  "--font-pdf-montserrat",
  "--font-pdf-playfair",
] as const;
export const MODERN_COLOR_FUNCTION_RE =
  /\b(?:lab|oklab|lch|oklch|color-mix)\(/i;
export const MODERN_BG_ATTRIBUTE = "data-pdf-bg-modern";
export const MODERN_BG_STYLE_ATTRIBUTE = "data-pdf-modern-bg-style";
export const COLOR_SANITIZE_PROPERTIES = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "filter",
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  "lighting-color",
] as const;
export const COLOR_STYLE_FIELDS = [
  "color",
  "backgroundColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "columnRuleColor",
] as const;

export const PRODUCT_LAYOUT_DEBUG_MAX_ITEMS = 10;

export const ROW_DEBUG_STYLE_FIELDS = [
  "display",
  "flexDirection",
  "flex",
  "alignItems",
  "justifyContent",
  "gap",
  "fontSize",
  "lineHeight",
  "boxSizing",
  "whiteSpace",
  "minWidth",
  "maxWidth",
  "textAlign",
  "position",
  "flexBasis",
  "flexShrink",
  "overflow",
  "top",
  "right",
  "marginTop",
  "paddingTop",
] as const;

export const TITLE_DEBUG_STYLE_FIELDS = [
  "display",
  "flexDirection",
  "flex",
  "flexBasis",
  "flexShrink",
  "alignItems",
  "justifyContent",
  "gap",
  "fontSize",
  "lineHeight",
  "verticalAlign",
  "position",
  "top",
  "right",
  "marginTop",
  "paddingTop",
  "transform",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "hyphens",
] as const;

export const TITLE_TEXT_DEBUG_STYLE_FIELDS = [
  "display",
  "fontSize",
  "lineHeight",
  "fontWeight",
  "fontStyle",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "verticalAlign",
  "marginTop",
  "paddingTop",
  "paddingBottom",
] as const;

export const QTY_DEBUG_STYLE_FIELDS = [
  "display",
  "flexDirection",
  "fontSize",
  "alignItems",
  "justifyContent",
  "gap",
  "lineHeight",
  "verticalAlign",
  "whiteSpace",
  "maxWidth",
  "textAlign",
  "position",
  "top",
  "right",
  "marginTop",
  "paddingTop",
  "flex",
  "flexBasis",
  "flexShrink",
  "minWidth",
] as const;

export const EXTRA_TAG_DEBUG_STYLE_FIELDS = [
  "display",
  "flexDirection",
  "flex",
  "flexBasis",
  "flexShrink",
  "alignItems",
  "justifyContent",
  "gap",
  "fontSize",
  "height",
  "verticalAlign",
  "lineHeight",
  "position",
  "top",
  "right",
  "whiteSpace",
  "marginTop",
  "paddingTop",
  "paddingBottom",
  "transform",
] as const;
