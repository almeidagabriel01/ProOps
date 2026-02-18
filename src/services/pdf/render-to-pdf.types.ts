export type PdfSourceLabel = "download" | "view" | "edit-preview" | "shared";

export interface CaptureDomPreparation {
  root: HTMLElement;
  cleanup: () => void;
}

export interface FontRequirement {
  family: string;
  weight: number;
  style: "normal" | "italic";
}

export interface ImageDebugEntry {
  index: number;
  src: string;
  currentSrc: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  loading: string;
  decodeStatus?: "ok" | "error" | "timeout";
  isDataUrl: boolean;
  isBlobUrl: boolean;
  isProxyUrl: boolean;
  captureSource?: string;
}

export interface ImageLoadResult {
  totalImages: number;
  decodedImages: number;
  failedImages: number;
  proxiedImagesCount: number;
  proxiedBackgroundImagesCount: number;
  directRemoteImageRequestsCount: number;
  waitMs: number;
  before: ImageDebugEntry[];
  after: ImageDebugEntry[];
  cleanup: () => void;
}

export interface ColorNormalizationResult {
  normalizedColorsCount: number;
  remainingUnsupportedColorCount: number;
  cleanup: () => void;
}

export interface ElementRectSnapshot {
  width: number;
  height: number;
  x: number;
  y: number;
  offsetTop: number;
  offsetLeft: number;
  offsetWidth: number;
  offsetHeight: number;
}

export interface CloneCapturePreparationStats {
  captureTargetSelector: string;
  captureTargetSnippet: string;
  captureTargetRect: ElementRectSnapshot | null;
  captureTargetPages: Array<{
    pageIndex: string;
    rect: ElementRectSnapshot | null;
    scrollWidth: number;
    scrollHeight: number;
  }>;
  visibleNodeCount: number;
  totalImages: number;
  decodedImages: number;
  failedImages: number;
  proxiedImagesCount: number;
  proxiedBackgroundImagesCount: number;
  directRemoteImageRequestsCount: number;
  unsupportedColorHitsByProperty: Record<string, number>;
  unsupportedColorElementsCount: number;
  bgModernFlaggedCount: number;
  globalOverridesApplied: boolean;
  normalizedColorsCount: number;
  remainingUnsupportedColorCount: number;
  imageWaitMs: number;
}

export interface OriginalImageSnapshot {
  index: number;
  src: string;
  srcset: string;
  sizes: string;
  loading: string;
  decoding: string;
  crossOrigin: string | null;
}

export interface TextLayoutSample {
  index: number;
  tag: string;
  className: string;
  text: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface LayoutSnapshot {
  scrollHeight: number;
  scrollWidth: number;
  samples: TextLayoutSample[];
}

export interface TextDebugComputedStyle {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  fontStretch: string;
  fontKerning: string;
  fontFeatureSettings: string;
  fontVariantLigatures: string;
  letterSpacing: string;
  wordSpacing: string;
  textRendering: string;
  whiteSpace: string;
  wordBreak: string;
}

export interface TextDebugAncestorTransform {
  depth: number;
  tag: string;
  className: string;
  transform: string;
  zoom: string;
}

export interface TextDebugSample {
  key: string;
  text: string;
  textShort: string;
  tag: string;
  className: string;
  transform: string;
  zoom: string;
  computed: TextDebugComputedStyle;
  ancestors: TextDebugAncestorTransform[];
}

export interface ElementStyleSnapshot {
  [key: string]: string;
}

export interface ProductRowDiagnostic {
  key: string;
  found: boolean;
  titleWrapperText: string;
  titleText: string;
  qtyText: string;
  extraTagText: string;
  rowRect: ElementRectSnapshot | null;
  titleWrapperRect: ElementRectSnapshot | null;
  titleTextRect: ElementRectSnapshot | null;
  qtyRect: ElementRectSnapshot | null;
  extraTagRect: ElementRectSnapshot | null;
  rowComputed: ElementStyleSnapshot | null;
  titleWrapperComputed: ElementStyleSnapshot | null;
  titleTextComputed: ElementStyleSnapshot | null;
  qtyComputed: ElementStyleSnapshot | null;
  extraTagComputed: ElementStyleSnapshot | null;
}

export interface RenderToPdfOptions {
  rootElement: HTMLElement;
  rootHint?: string;
  proposalTitle?: string;
  tenantId?: string;
  sourceLabel?: PdfSourceLabel;
  apiBaseUrl?: string;
  scale?: number;
}

export interface RenderToPdfResult {
  blob: Blob;
  arrayBuffer: ArrayBuffer;
  filename: string;
  pageCount: number;
  canvasSizes: Array<{ width: number; height: number }>;
  blobSize: number;
  hashHex: string;
  metrics: {
    sourceLabel: PdfSourceLabel;
    rootHint: string;
    rootDescriptor: string;
    pageElementsCount: number;
    rootImagesCount: number;
    fontsReadyMs: number;
    fontsTimeout: boolean;
    fontRequirements: FontRequirement[];
    totalImages: number;
    decodedImages: number;
    failedImages: number;
    proxiedImagesCount: number;
    proxiedBackgroundImagesCount: number;
    directRemoteImageRequestsCount: number;
    unsupportedColorHitsByProperty: Record<string, number>;
    unsupportedColorElementsCount: number;
    bgModernFlaggedCount: number;
    globalOverridesApplied: boolean;
    normalizedColorsCount: number;
    remainingUnsupportedColorCount: number;
    blankCanvasPages: number;
    imageWaitMs: number;
    durationMs: number;
  };
}

export type DebugLogger = (message: string, payload?: unknown) => void;
