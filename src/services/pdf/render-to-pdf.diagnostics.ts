import {
  CAPTURE_FONT_VARIABLES,
  CAPTURE_TARGET_ATTR,
  EXTRA_TAG_DEBUG_STYLE_FIELDS,
  PRODUCT_LAYOUT_DEBUG_MAX_ITEMS,
  QTY_DEBUG_STYLE_FIELDS,
  ROW_DEBUG_STYLE_FIELDS,
  TITLE_DEBUG_STYLE_FIELDS,
  TITLE_TEXT_DEBUG_STYLE_FIELDS,
} from "./render-to-pdf.constants";
import {
  ElementRectSnapshot,
  ElementStyleSnapshot,
  LayoutSnapshot,
  ProductRowDiagnostic,
  TextDebugAncestorTransform,
  TextDebugComputedStyle,
  TextDebugSample,
  TextLayoutSample,
} from "./render-to-pdf.types";
import { getPdfDebugEnabled } from "./render-to-pdf.helpers";

export function collectTextLayoutSamples(
  root: HTMLElement,
  limit = 5,
): TextLayoutSample[] {
  if (!getPdfDebugEnabled()) return [];
  const doc = root.ownerDocument;
  const view = doc.defaultView || window;
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("h1, h2, h3, p, span, td, th, div"),
  )
    .filter((el) => (el.textContent || "").trim().length > 0)
    .slice(0, limit);

  return candidates.map((element, index) => {
    const computed = view.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      index,
      tag: element.tagName.toLowerCase(),
      className: element.className || "",
      text: (element.textContent || "").trim().slice(0, 120),
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
      x: Number(rect.x.toFixed(2)),
      y: Number(rect.y.toFixed(2)),
    };
  });
}

export function createLayoutSnapshot(
  root: HTMLElement,
  limit = 5,
): LayoutSnapshot {
  return {
    scrollHeight: root.scrollHeight,
    scrollWidth: root.scrollWidth,
    samples: collectTextLayoutSamples(root, limit),
  };
}

export function areLayoutSnapshotsStable(
  previous: LayoutSnapshot,
  current: LayoutSnapshot,
): boolean {
  if (previous.scrollHeight !== current.scrollHeight) return false;
  if (previous.scrollWidth !== current.scrollWidth) return false;
  if (previous.samples.length !== current.samples.length) return false;

  return previous.samples.every((sample, index) => {
    const target = current.samples[index];
    if (!target) return false;
    return (
      sample.fontFamily === target.fontFamily &&
      sample.fontWeight === target.fontWeight &&
      sample.fontStyle === target.fontStyle &&
      sample.lineHeight === target.lineHeight &&
      sample.letterSpacing === target.letterSpacing &&
      Math.abs(sample.width - target.width) < 0.2 &&
      Math.abs(sample.height - target.height) < 0.2 &&
      Math.abs(sample.x - target.x) < 0.2 &&
      Math.abs(sample.y - target.y) < 0.2
    );
  });
}

export function summarizeLayoutDiff(
  source: LayoutSnapshot,
  capture: LayoutSnapshot,
): Record<string, unknown> {
  const compared = Math.min(source.samples.length, capture.samples.length);
  let changed = 0;

  for (let i = 0; i < compared; i += 1) {
    const a = source.samples[i];
    const b = capture.samples[i];
    if (
      a.fontFamily !== b.fontFamily ||
      a.fontWeight !== b.fontWeight ||
      a.fontStyle !== b.fontStyle ||
      a.lineHeight !== b.lineHeight ||
      a.letterSpacing !== b.letterSpacing ||
      Math.abs(a.width - b.width) >= 0.2 ||
      Math.abs(a.height - b.height) >= 0.2
    ) {
      changed += 1;
    }
  }

  return {
    sourceScrollHeight: source.scrollHeight,
    captureScrollHeight: capture.scrollHeight,
    sourceScrollWidth: source.scrollWidth,
    captureScrollWidth: capture.scrollWidth,
    comparedSamples: compared,
    changedSamples: changed,
  };
}

function normalizeDebugText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildTextDebugKey(element: HTMLElement): string {
  const text = normalizeDebugText((element.textContent || "").slice(0, 240));
  return `${element.tagName.toLowerCase()}|${text}`;
}

function getAncestorTransforms(
  element: HTMLElement,
  stopAt: HTMLElement,
): TextDebugAncestorTransform[] {
  const output: TextDebugAncestorTransform[] = [];
  const doc = element.ownerDocument;
  const view = doc.defaultView || window;
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && depth < 12) {
    const computed = view.getComputedStyle(current);
    output.push({
      depth,
      tag: current.tagName.toLowerCase(),
      className: current.className || "",
      transform: computed.transform || "none",
      zoom: computed.zoom || "normal",
    });
    if (current === stopAt) break;
    current = current.parentElement;
    depth += 1;
  }

  return output;
}

export function findDebugTextTargets(
  root: HTMLElement,
  limit = 3,
): HTMLElement[] {
  if (!getPdfDebugEnabled()) return [];
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      "p, div, span, td, th, h1, h2, h3, h4, h5, h6",
    ),
  ).filter((element) => {
    const text = normalizeDebugText(element.textContent || "");
    return text.length >= 24 && !element.querySelector("img, svg, canvas");
  });

  return candidates.slice(0, limit);
}

export function collectTextDebugSamples(
  root: HTMLElement,
  selectedKeys?: string[],
): TextDebugSample[] {
  if (!getPdfDebugEnabled()) return [];
  const doc = root.ownerDocument;
  const view = doc.defaultView || window;
  const allCandidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      "p, div, span, td, th, h1, h2, h3, h4, h5, h6",
    ),
  ).filter(
    (element) => normalizeDebugText(element.textContent || "").length >= 24,
  );

  const selectedElements =
    selectedKeys && selectedKeys.length > 0
      ? selectedKeys
          .map(
            (key) =>
              allCandidates.find(
                (element) => buildTextDebugKey(element) === key,
              ) || null,
          )
          .filter((element): element is HTMLElement => Boolean(element))
      : findDebugTextTargets(root, 3);

  return selectedElements.map((element) => {
    const computed = view.getComputedStyle(element);
    return {
      key: buildTextDebugKey(element),
      text: normalizeDebugText(element.textContent || ""),
      textShort: (normalizeDebugText(element.textContent || "") || "").slice(
        0,
        140,
      ),
      tag: element.tagName.toLowerCase(),
      className: element.className || "",
      transform: computed.transform || "none",
      zoom: computed.zoom || "normal",
      computed: {
        fontFamily: computed.fontFamily || "",
        fontWeight: computed.fontWeight || "",
        fontStyle: computed.fontStyle || "",
        fontStretch: computed.fontStretch || "",
        fontKerning: computed.fontKerning || "",
        fontFeatureSettings: computed.fontFeatureSettings || "",
        fontVariantLigatures: computed.fontVariantLigatures || "",
        letterSpacing: computed.letterSpacing || "",
        wordSpacing: computed.wordSpacing || "",
        textRendering: computed.textRendering || "",
        whiteSpace: computed.whiteSpace || "",
        wordBreak: computed.wordBreak || "",
      },
      ancestors: getAncestorTransforms(element, root),
    };
  });
}

export function summarizeTextDebugDiffs(
  source: TextDebugSample[],
  capture: TextDebugSample[],
): Array<Record<string, unknown>> {
  return source.map((sourceSample) => {
    const captureSample =
      capture.find((entry) => entry.key === sourceSample.key) || null;
    const compare = (field: keyof TextDebugComputedStyle) => {
      const sourceValue = sourceSample.computed[field];
      const captureValue = captureSample?.computed[field] || "";
      return sourceValue === captureValue
        ? null
        : { source: sourceValue, capture: captureValue };
    };

    return {
      key: sourceSample.key,
      text: sourceSample.textShort,
      foundInCapture: Boolean(captureSample),
      fontFamily: compare("fontFamily"),
      fontWeight: compare("fontWeight"),
      fontStyle: compare("fontStyle"),
      fontStretch: compare("fontStretch"),
      fontKerning: compare("fontKerning"),
      fontFeatureSettings: compare("fontFeatureSettings"),
      fontVariantLigatures: compare("fontVariantLigatures"),
      letterSpacing: compare("letterSpacing"),
      wordSpacing: compare("wordSpacing"),
      textRendering: compare("textRendering"),
      whiteSpace: compare("whiteSpace"),
      wordBreak: compare("wordBreak"),
      transform:
        sourceSample.transform === (captureSample?.transform || "")
          ? null
          : {
              source: sourceSample.transform,
              capture: captureSample?.transform || "",
            },
      zoom:
        sourceSample.zoom === (captureSample?.zoom || "")
          ? null
          : { source: sourceSample.zoom, capture: captureSample?.zoom || "" },
      ancestorTransforms: {
        source: sourceSample.ancestors.map((entry) => ({
          depth: entry.depth,
          tag: entry.tag,
          transform: entry.transform,
          zoom: entry.zoom,
        })),
        capture:
          captureSample?.ancestors.map((entry) => ({
            depth: entry.depth,
            tag: entry.tag,
            transform: entry.transform,
            zoom: entry.zoom,
          })) || [],
      },
    };
  });
}

function resolveCssUrl(rawUrl: string, baseUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("about:") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return trimmed;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function normalizeCssUrls(cssText: string, baseUrl: string): string {
  return cssText.replace(/url\(([^)]+)\)/gi, (match, rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return match;
    if (value.startsWith("var(")) return match;

    const unquoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;

    const resolved = resolveCssUrl(unquoted, baseUrl);
    return `url("${resolved}")`;
  });
}

function extractFontFaceCssFromDocument(doc: Document): string {
  const blocks: string[] = [];
  const styleSheets = Array.from(doc.styleSheets);

  styleSheets.forEach((sheet) => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      rules.forEach((rule) => {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          const baseUrl =
            sheet.href ||
            doc.baseURI ||
            (typeof window !== "undefined" ? window.location.origin : "");
          blocks.push(normalizeCssUrls(rule.cssText, baseUrl));
        }
      });
    } catch {
      return;
    }
  });

  return blocks.join("\n");
}

function applyCaptureFontVariables(
  sourceDoc: Document,
  captureDoc: Document,
): void {
  const sourceStyle = sourceDoc.defaultView?.getComputedStyle(
    sourceDoc.documentElement,
  );
  if (!sourceStyle) return;
  CAPTURE_FONT_VARIABLES.forEach((variableName) => {
    const value = sourceStyle.getPropertyValue(variableName).trim();
    if (value) {
      captureDoc.documentElement.style.setProperty(variableName, value);
      captureDoc.body.style.setProperty(variableName, value);
    }
  });
}

export function injectFontFaceContextIntoCaptureDocument(
  sourceDoc: Document,
  captureDoc: Document,
): void {
  const css = extractFontFaceCssFromDocument(sourceDoc);
  if (!css) return;
  const style = captureDoc.createElement("style");
  style.setAttribute("data-pdf-font-face", "1");
  style.textContent = css;
  captureDoc.head.appendChild(style);
  applyCaptureFontVariables(sourceDoc, captureDoc);
}

export function areNumberArraysStable(
  previous: number[],
  current: number[],
  epsilon = 0.2,
): boolean {
  if (previous.length !== current.length) return false;
  return previous.every(
    (value, index) => Math.abs(value - current[index]) <= epsilon,
  );
}

export function getElementRectSnapshot(
  element: HTMLElement | null,
): ElementRectSnapshot | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    width: Number(rect.width.toFixed(2)),
    height: Number(rect.height.toFixed(2)),
    x: Number(rect.x.toFixed(2)),
    y: Number(rect.y.toFixed(2)),
    offsetTop: element.offsetTop,
    offsetLeft: element.offsetLeft,
    offsetWidth: element.offsetWidth,
    offsetHeight: element.offsetHeight,
  };
}

export function getCaptureTargetSelector(rootElement: HTMLElement): string {
  if (rootElement.id) return `#${rootElement.id}`;
  return `[${CAPTURE_TARGET_ATTR}="1"]`;
}

export function getPageRectDiagnostics(root: HTMLElement): Array<{
  pageIndex: string;
  rect: ElementRectSnapshot | null;
  scrollWidth: number;
  scrollHeight: number;
}> {
  const pages = Array.from(
    root.querySelectorAll<HTMLElement>("[data-page-index]"),
  );
  return pages.map((pageElement) => ({
    pageIndex: pageElement.getAttribute("data-page-index") || "",
    rect: getElementRectSnapshot(pageElement),
    scrollWidth: pageElement.scrollWidth,
    scrollHeight: pageElement.scrollHeight,
  }));
}

export function countVisibleNodes(root: HTMLElement, view: Window): number {
  if (!getPdfDebugEnabled()) return 0;
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  let visibleCount = 0;
  nodes.forEach((node) => {
    const style = view.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return;
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      visibleCount += 1;
    }
  });
  return visibleCount;
}

export function inspectCanvasBlank(canvas: HTMLCanvasElement): {
  isBlankCanvas: boolean;
  samples: Array<{
    x: number;
    y: number;
    rgba: [number, number, number, number];
  }>;
} {
  const probeCanvas = document.createElement("canvas");
  probeCanvas.width = canvas.width;
  probeCanvas.height = canvas.height;
  const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
  const samplePoints = [
    { x: 1, y: 1 },
    { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) },
    {
      x: Math.max(1, Math.floor(canvas.width / 2)),
      y: Math.max(1, canvas.height - 2),
    },
  ];

  if (!probeCtx || canvas.width <= 0 || canvas.height <= 0) {
    return {
      isBlankCanvas: true,
      samples: samplePoints.map((point) => ({
        x: point.x,
        y: point.y,
        rgba: [0, 0, 0, 0],
      })),
    };
  }

  probeCtx.drawImage(canvas, 0, 0);

  const samples = samplePoints.map((point) => {
    const x = Math.min(Math.max(0, point.x), canvas.width - 1);
    const y = Math.min(Math.max(0, point.y), canvas.height - 1);
    const data = probeCtx.getImageData(x, y, 1, 1).data;
    return {
      x,
      y,
      rgba: [data[0], data[1], data[2], data[3]] as [
        number,
        number,
        number,
        number,
      ],
    };
  });

  const isBlankCanvas = samples.every((sample) => {
    const [r, g, b, a] = sample.rgba;
    return a === 0 || (r === 255 && g === 255 && b === 255 && a === 255);
  });

  return { isBlankCanvas, samples };
}

function getElementStyleSnapshot(
  element: HTMLElement | null,
  fields: readonly string[],
): ElementStyleSnapshot | null {
  if (!element) return null;
  const computed = window.getComputedStyle(element);
  const output: ElementStyleSnapshot = {};
  fields.forEach((field) => {
    const value = computed[field as keyof CSSStyleDeclaration];
    if (typeof value === "string") {
      output[field] = value;
    }
  });
  return output;
}

function findQtyElement(row: HTMLElement | null): HTMLElement | null {
  if (!row) return null;
  return row.querySelector<HTMLElement>("[data-pdf-item-qty]");
}

function findTitleElement(row: HTMLElement | null): HTMLElement | null {
  if (!row) return null;
  return row.querySelector<HTMLElement>("[data-pdf-item-title]");
}

function findTitleTextElement(
  row: HTMLElement | null,
  titleElement: HTMLElement | null,
): HTMLElement | null {
  if (!row) return null;
  const tagged = row.querySelector<HTMLElement>("[data-pdf-item-title-text]");
  if (tagged) return tagged;

  if (titleElement) {
    const structuralText = Array.from(
      titleElement.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6, span, p, div",
      ),
    ).find((element) => !element.querySelector("img, svg, canvas"));
    if (structuralText) return structuralText;
  }

  return null;
}

function findExtraTagElement(row: HTMLElement | null): HTMLElement | null {
  if (!row) return null;
  return row.querySelector<HTMLElement>("[data-pdf-item-extra-tag]");
}

export function collectProductLayoutDiagnostics(
  root: HTMLElement,
  maxItems = PRODUCT_LAYOUT_DEBUG_MAX_ITEMS,
): ProductRowDiagnostic[] {
  if (!getPdfDebugEnabled()) return [];
  const rows = Array.from(
    root.querySelectorAll<HTMLElement>("[data-pdf-item-row]"),
  ).slice(0, maxItems);

  return rows.map((rowElement, index) => {
    const titleWrapperElement = findTitleElement(rowElement);
    const titleTextElement = findTitleTextElement(
      rowElement,
      titleWrapperElement,
    );
    const qtyElement = findQtyElement(rowElement);
    const extraTagElement = findExtraTagElement(rowElement);

    return {
      key: rowElement.getAttribute("data-pdf-item-id") || `row-${index + 1}`,
      found: Boolean(titleTextElement && rowElement),
      titleWrapperText: normalizeDebugText(
        titleWrapperElement?.textContent || "",
      ),
      titleText: normalizeDebugText(titleTextElement?.textContent || ""),
      qtyText: normalizeDebugText(qtyElement?.textContent || ""),
      extraTagText: normalizeDebugText(extraTagElement?.textContent || ""),
      rowRect: getElementRectSnapshot(rowElement),
      titleWrapperRect: getElementRectSnapshot(titleWrapperElement),
      titleTextRect: getElementRectSnapshot(titleTextElement),
      qtyRect: getElementRectSnapshot(qtyElement),
      extraTagRect: getElementRectSnapshot(extraTagElement),
      rowComputed: getElementStyleSnapshot(rowElement, ROW_DEBUG_STYLE_FIELDS),
      titleWrapperComputed: getElementStyleSnapshot(
        titleWrapperElement,
        TITLE_DEBUG_STYLE_FIELDS,
      ),
      titleTextComputed: getElementStyleSnapshot(
        titleTextElement,
        TITLE_TEXT_DEBUG_STYLE_FIELDS,
      ),
      qtyComputed: getElementStyleSnapshot(qtyElement, QTY_DEBUG_STYLE_FIELDS),
      extraTagComputed: getElementStyleSnapshot(
        extraTagElement,
        EXTRA_TAG_DEBUG_STYLE_FIELDS,
      ),
    };
  });
}

export function summarizeProductLayoutDiagnostics(
  source: ProductRowDiagnostic[],
  capture: ProductRowDiagnostic[],
): Array<Record<string, unknown>> {
  return source.map((sourceEntry) => {
    const captureEntry =
      capture.find((entry) => entry.key === sourceEntry.key) || null;

    const compareRect = (
      sourceRect: ElementRectSnapshot | null,
      captureRect: ElementRectSnapshot | null,
    ): Record<string, unknown> | null => {
      if (!sourceRect && !captureRect) return null;
      if (!sourceRect || !captureRect)
        return { source: sourceRect, capture: captureRect };

      return {
        width: Number((captureRect.width - sourceRect.width).toFixed(2)),
        height: Number((captureRect.height - sourceRect.height).toFixed(2)),
        x: Number((captureRect.x - sourceRect.x).toFixed(2)),
        y: Number((captureRect.y - sourceRect.y).toFixed(2)),
        offsetTop: captureRect.offsetTop - sourceRect.offsetTop,
        offsetLeft: captureRect.offsetLeft - sourceRect.offsetLeft,
        offsetWidth: captureRect.offsetWidth - sourceRect.offsetWidth,
        offsetHeight: captureRect.offsetHeight - sourceRect.offsetHeight,
      };
    };

    const compareStyles = (
      sourceStyles: ElementStyleSnapshot | null,
      captureStyles: ElementStyleSnapshot | null,
    ): Record<string, unknown> | null => {
      if (!sourceStyles && !captureStyles) return null;
      if (!sourceStyles || !captureStyles)
        return { source: sourceStyles, capture: captureStyles };

      const keys = new Set([
        ...Object.keys(sourceStyles),
        ...Object.keys(captureStyles),
      ]);
      const diff: Record<string, unknown> = {};
      keys.forEach((key) => {
        const sourceValue = sourceStyles[key] || "";
        const captureValue = captureStyles[key] || "";
        if (sourceValue !== captureValue) {
          diff[key] = { source: sourceValue, capture: captureValue };
        }
      });
      return diff;
    };

    const isWithinOnePixel = (
      rectDelta: Record<string, unknown> | null,
    ): boolean | null => {
      if (!rectDelta) return null;
      const numericValues = ["width", "height", "x", "y"].map((key) => {
        const value = rectDelta[key];
        return typeof value === "number" ? Math.abs(value) : 0;
      });
      return numericValues.every((value) => value <= 1);
    };

    const titleWrapperRectDelta = compareRect(
      sourceEntry.titleWrapperRect,
      captureEntry?.titleWrapperRect || null,
    );
    const titleTextRectDelta = compareRect(
      sourceEntry.titleTextRect,
      captureEntry?.titleTextRect || null,
    );
    const extraTagRectDelta = compareRect(
      sourceEntry.extraTagRect,
      captureEntry?.extraTagRect || null,
    );
    const rowStyleDiff = compareStyles(
      sourceEntry.rowComputed,
      captureEntry?.rowComputed || null,
    );
    const titleWrapperStyleDiff = compareStyles(
      sourceEntry.titleWrapperComputed,
      captureEntry?.titleWrapperComputed || null,
    );
    const titleTextStyleDiff = compareStyles(
      sourceEntry.titleTextComputed,
      captureEntry?.titleTextComputed || null,
    );
    const extraTagStyleDiff = compareStyles(
      sourceEntry.extraTagComputed,
      captureEntry?.extraTagComputed || null,
    );
    const qtyRectDelta = compareRect(
      sourceEntry.qtyRect,
      captureEntry?.qtyRect || null,
    );
    const rowRectDelta = compareRect(
      sourceEntry.rowRect,
      captureEntry?.rowRect || null,
    );

    const isQtyWithinRow = (
      rowRect: ElementRectSnapshot | null,
      qtyRect: ElementRectSnapshot | null,
    ): boolean | null => {
      if (!rowRect || !qtyRect) return null;
      return qtyRect.x + qtyRect.width <= rowRect.x + rowRect.width + 1;
    };

    return {
      key: sourceEntry.key,
      foundInCapture: Boolean(captureEntry?.found),
      sourceTitleWrapperText: sourceEntry.titleWrapperText,
      captureTitleWrapperText: captureEntry?.titleWrapperText || "",
      sourceTitleText: sourceEntry.titleText,
      captureTitleText: captureEntry?.titleText || "",
      sourceQtyText: sourceEntry.qtyText,
      captureQtyText: captureEntry?.qtyText || "",
      sourceExtraTagText: sourceEntry.extraTagText,
      captureExtraTagText: captureEntry?.extraTagText || "",
      rowRectDelta,
      titleWrapperRectDelta,
      titleTextRectDelta,
      qtyRectDelta,
      extraTagRectDelta,
      rowStyleDiff,
      titleWrapperStyleDiff,
      titleTextStyleDiff,
      qtyStyleDiff: compareStyles(
        sourceEntry.qtyComputed,
        captureEntry?.qtyComputed || null,
      ),
      extraTagStyleDiff,
      qtyWithinRow: {
        source: isQtyWithinRow(sourceEntry.rowRect, sourceEntry.qtyRect),
        capture: isQtyWithinRow(
          captureEntry?.rowRect || null,
          captureEntry?.qtyRect || null,
        ),
      },
      within1px: {
        titleWrapperRect: isWithinOnePixel(titleWrapperRectDelta),
        titleTextRect: isWithinOnePixel(titleTextRectDelta),
        extraTagRect: isWithinOnePixel(extraTagRectDelta),
      },
    };
  });
}
