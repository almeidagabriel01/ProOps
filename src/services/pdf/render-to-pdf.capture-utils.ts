import {
  COLOR_SANITIZE_PROPERTIES,
  MODERN_BG_ATTRIBUTE,
  MODERN_BG_STYLE_ATTRIBUTE,
  MODERN_COLOR_FUNCTION_RE,
} from "./render-to-pdf.constants";
import { getPdfDebugEnabled } from "./render-to-pdf.helpers";

const MODERN_COLOR_RE = /\b(lab|oklch|oklab|lch|color-mix)\s*\(/i;
const INLINE_MODERN_COLOR_SELECTOR = [
  '[style*="lab("]',
  '[style*="oklch("]',
  '[style*="oklab("]',
  '[style*="lch("]',
  '[style*="color-mix("]',
].join(", ");

function walkStyleRules(
  rules: CSSRuleList,
  visit: (rule: CSSStyleRule) => void,
): void {
  Array.from(rules).forEach((rule) => {
    if (rule instanceof CSSStyleRule) {
      visit(rule);
      return;
    }

    const grouped = rule as CSSRule & { cssRules?: CSSRuleList };
    if (grouped.cssRules) {
      walkStyleRules(grouped.cssRules, visit);
    }
  });
}

function getDeclarationFallback(propertyName: string): string | null {
  const lowered = propertyName.toLowerCase();
  if (lowered === "background-image") return "none";
  if (lowered.includes("background")) return "rgb(255, 255, 255)";
  if (lowered.includes("border")) return "rgb(0, 0, 0)";
  if (lowered === "box-shadow" || lowered === "filter") return "none";
  if (
    lowered.includes("color") ||
    lowered === "fill" ||
    lowered === "stroke" ||
    lowered === "stop-color" ||
    lowered === "flood-color" ||
    lowered === "lighting-color"
  ) {
    return "rgb(0, 0, 0)";
  }
  return null;
}

function resolveDeclarationValue(
  probe: HTMLElement,
  view: Window,
  propertyName: string,
  rawValue: string,
): string | null {
  try {
    probe.style.removeProperty(propertyName);
    probe.style.setProperty(propertyName, rawValue);
    const resolved = view
      .getComputedStyle(probe)
      .getPropertyValue(propertyName)
      .trim();
    probe.style.removeProperty(propertyName);
    if (!resolved || MODERN_COLOR_RE.test(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}

function sanitizeModernColorFunctionsInText(value: string): string {
  if (!value || !MODERN_COLOR_RE.test(value)) return value;
  return value.replace(
    /\b(?:lab|oklab|lch|oklch|color-mix)\([^()]*\)/gi,
    "rgb(0, 0, 0)",
  );
}

/**
 * Fast O(CSS rules) color sanitization for html2canvas.
 *
 * Instead of traversing every DOM node and calling getComputedStyle (very expensive
 * on large proposals), this function:
 * 1. Scans all stylesheet rules once to find CSS custom properties (--*) that use
 *    unsupported color functions (lab, oklch, oklab, lch).
 * 2. Resolves each of these variables to a safe RGB equivalent using a hidden probe element.
 * 3. Injects a single <style> block on :root that overrides all bad variables at once.
 *
 * This is O(number of CSS rules) instead of O(number of DOM nodes × CSS properties),
 * which is many times faster on proposals with 100+ products.
 */
export function injectModernColorFallbacksFromStylesheets(
  clonedDoc: Document,
): void {
  const view = clonedDoc.defaultView;
  if (!view) return;

  const styleTags = Array.from(clonedDoc.querySelectorAll<HTMLStyleElement>("style"));
  styleTags.forEach((styleTag) => {
    if (!styleTag.textContent) return;
    styleTag.textContent = sanitizeModernColorFunctionsInText(styleTag.textContent);
  });

  const inlineStyledNodes = Array.from(
    clonedDoc.querySelectorAll<HTMLElement>('[style*="lab("], [style*="oklch("], [style*="oklab("], [style*="lch("], [style*="color-mix("]'),
  );
  inlineStyledNodes.forEach((node) => {
    const styleAttr = node.getAttribute("style");
    if (!styleAttr) return;
    node.setAttribute("style", sanitizeModernColorFunctionsInText(styleAttr));
  });

  const badVars = new Map<string, string>(); // varName -> safeValue
  const declarationOverrides = new Map<string, Map<string, string>>(); // selector -> (prop -> safeValue)

  const probe = clonedDoc.createElement("span");
  probe.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:0;height:0;visibility:hidden;";
  clonedDoc.body.appendChild(probe);

  const setDeclarationOverride = (
    selector: string,
    propertyName: string,
    safeValue: string,
  ): void => {
    const byProperty = declarationOverrides.get(selector) || new Map();
    byProperty.set(propertyName, safeValue);
    declarationOverrides.set(selector, byProperty);
  };

  Array.from(clonedDoc.styleSheets).forEach((sheet) => {
    try {
      walkStyleRules(sheet.cssRules, (rule) => {
        const style = rule.style;
        const selector = rule.selectorText || "";
        for (let i = 0; i < style.length; i += 1) {
          const prop = style.item(i);
          const rawValue = style.getPropertyValue(prop);
          if (!MODERN_COLOR_RE.test(rawValue)) continue;

          if (prop.startsWith("--")) {
            const resolved = resolveDeclarationValue(probe, view, "color", rawValue);
            if (resolved) {
              badVars.set(prop, resolved);
            } else {
              const isLikelyFg =
                prop.includes("foreground") ||
                prop.includes("text") ||
                prop.includes("fg");
              const isLikelyBorder =
                prop.includes("border") ||
                prop.includes("ring") ||
                prop.includes("outline");
              badVars.set(
                prop,
                isLikelyFg
                  ? "rgb(0, 0, 0)"
                  : isLikelyBorder
                    ? "rgba(0, 0, 0, 0.3)"
                    : "transparent",
              );
            }
            continue;
          }

          const resolved = resolveDeclarationValue(probe, view, prop, rawValue);
          const sanitizedRaw = sanitizeModernColorFunctionsInText(rawValue);
          const sanitizedRawUsable =
            sanitizedRaw &&
            !hasUnsupportedColorFunctionInValue(sanitizedRaw) &&
            sanitizedRaw !== rawValue
              ? sanitizedRaw
              : "";
          const fallback =
            sanitizedRawUsable || resolved || getDeclarationFallback(prop);
          if (!fallback || !selector) continue;
          setDeclarationOverride(selector, prop, fallback);
        }
      });
    } catch {
      // Cross-origin stylesheet — skip
    }
  });

  const inlineNodes = Array.from(
    clonedDoc.querySelectorAll<HTMLElement>(INLINE_MODERN_COLOR_SELECTOR),
  );
  inlineNodes.forEach((node) => {
    const inlineStyle = node.style;
    const propertyNames: string[] = [];
    for (let index = 0; index < inlineStyle.length; index += 1) {
      const propertyName = inlineStyle.item(index);
      if (propertyName) propertyNames.push(propertyName);
    }
    propertyNames.forEach((propertyName) => {
      const rawValue = inlineStyle.getPropertyValue(propertyName);
      if (!MODERN_COLOR_RE.test(rawValue)) return;
      const resolved = resolveDeclarationValue(probe, view, propertyName, rawValue);
      const sanitizedRaw = sanitizeModernColorFunctionsInText(rawValue);
      const sanitizedRawUsable =
        sanitizedRaw &&
        !hasUnsupportedColorFunctionInValue(sanitizedRaw) &&
        sanitizedRaw !== rawValue
          ? sanitizedRaw
          : "";
      const fallback =
        sanitizedRawUsable || resolved || getDeclarationFallback(propertyName);
      if (!fallback) return;
      inlineStyle.setProperty(propertyName, fallback, "important");
    });

    ["fill", "stroke", "stop-color", "flood-color", "lighting-color"].forEach(
      (attributeName) => {
        const rawValue = node.getAttribute(attributeName) || "";
        if (!MODERN_COLOR_RE.test(rawValue)) return;
        node.setAttribute(attributeName, "rgb(0, 0, 0)");
      },
    );
  });

  probe.remove();

  if (badVars.size === 0 && declarationOverrides.size === 0) return;

  const rules: string[] = [];
  if (badVars.size > 0) {
    const variableLines = Array.from(badVars.entries()).map(
      ([varName, safeValue]) => `  ${varName}: ${safeValue};`,
    );
    rules.push(`:root {\n${variableLines.join("\n")}\n}`);
  }
  declarationOverrides.forEach((byProperty, selector) => {
    const propertyLines = Array.from(byProperty.entries()).map(
      ([propertyName, safeValue]) =>
        `  ${propertyName}: ${safeValue} !important;`,
    );
    rules.push(`${selector} {\n${propertyLines.join("\n")}\n}`);
  });

  const styleEl = clonedDoc.createElement("style");
  styleEl.setAttribute("data-pdf-color-fallback", "1");
  styleEl.textContent = rules.join("\n");
  clonedDoc.head.appendChild(styleEl);
}

export function containsModernColor(value: string): boolean {
  return /(lab|oklch|oklab|lch|color)\(/i.test(value);
}

export function safeCssColor(
  input: string,
  canvasCtx: CanvasRenderingContext2D | null,
  propertyName: string,
): string {
  if (!input || input === "none") return input;
  if (input === "transparent") return "transparent";
  if (input.startsWith("#") || input.startsWith("rgb")) return input;
  if (!canvasCtx) return propertyName === "color" ? "#000000" : "transparent";

  try {
    canvasCtx.clearRect(0, 0, 1, 1);
    canvasCtx.fillStyle = input;
    canvasCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data;
    if (a === 0 && propertyName === "color") return "#000000";
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  } catch {
    return propertyName === "color" ? "#000000" : "transparent";
  }
}

export function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

export function normalizeWeight(value: string): number {
  const lowered = value.trim().toLowerCase();
  if (lowered === "normal") return 400;
  if (lowered === "bold") return 700;
  const parsed = Number.parseInt(lowered, 10);
  if (Number.isFinite(parsed)) return parsed;
  return 400;
}

export function normalizeStyle(value: string): "normal" | "italic" {
  return value.trim().toLowerCase() === "italic" ? "italic" : "normal";
}

export function hasUnsupportedColorFunction(value: string): boolean {
  return MODERN_COLOR_FUNCTION_RE.test((value || "").toLowerCase());
}

export function isHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isCrossOriginHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    return isHttp && parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function buildProxyImageUrl(
  rawUrl: string,
  options: {
    apiBaseUrl: string;
    tenantId?: string;
    disableCache: boolean;
    index?: number;
  },
): string {
  if (rawUrl.includes("/v1/aux/proxy-image")) {
    return rawUrl;
  }

  const params = new URLSearchParams({
    url: rawUrl,
    capture: "1",
  });

  if (options.disableCache) {
    params.set("noStore", "1");
    params.set("cb", `${Date.now()}-${options.index || 0}`);
  }

  return `${options.apiBaseUrl}/v1/aux/proxy-image?${params.toString()}`;
}

export function replaceBackgroundUrlsWithProxy(
  backgroundValue: string,
  options: { apiBaseUrl: string; tenantId?: string; disableCache: boolean },
): { value: string; replacedCount: number } {
  if (!backgroundValue || !backgroundValue.includes("url(")) {
    return { value: backgroundValue, replacedCount: 0 };
  }

  const backgroundUrlRegex = /url\((['"]?)(.*?)\1\)/gi;
  let replacedCount = 0;
  const value = backgroundValue.replace(
    backgroundUrlRegex,
    (_fullMatch, quote: string, urlValue: string) => {
      const rawUrl = (urlValue || "").trim();
      if (
        !rawUrl ||
        rawUrl.startsWith("data:") ||
        rawUrl.startsWith("blob:") ||
        rawUrl.startsWith("about:")
      ) {
        return `url(${quote || ""}${rawUrl}${quote || ""})`;
      }

      if (!isCrossOriginHttpUrl(rawUrl)) {
        return `url(${quote || ""}${rawUrl}${quote || ""})`;
      }

      replacedCount += 1;
      const proxied = buildProxyImageUrl(rawUrl, {
        ...options,
        index: replacedCount,
      });
      return `url("${proxied}")`;
    },
  );

  return { value, replacedCount };
}

export function hasUnsupportedColorFunctionInValue(value: string): boolean {
  return hasUnsupportedColorFunction(value || "");
}

export function buildUnsupportedColorFunctionFlags(value: string): {
  hasAny: boolean;
  hasLab: boolean;
  hasOklab: boolean;
  hasLch: boolean;
  hasOklch: boolean;
  hasColorMix: boolean;
} {
  const safeValue = value || "";
  return {
    hasAny: hasUnsupportedColorFunctionInValue(safeValue),
    hasLab: /\blab\(/i.test(safeValue),
    hasOklab: /\boklab\(/i.test(safeValue),
    hasLch: /\blch\(/i.test(safeValue),
    hasOklch: /\boklch\(/i.test(safeValue),
    hasColorMix: /\bcolor-mix\(/i.test(safeValue),
  };
}

export function incrementHitCounter(
  counter: Record<string, number>,
  key: string,
): void {
  counter[key] = (counter[key] || 0) + 1;
}

export function resolveCssPropertyInClone(
  resolver: HTMLElement,
  view: Window,
  propertyName: string,
  rawValue: string,
): string | null {
  if (!rawValue) return null;
  resolver.style.setProperty(propertyName, "");
  resolver.style.setProperty(propertyName, rawValue);
  const resolved = view
    .getComputedStyle(resolver)
    .getPropertyValue(propertyName);
  if (!resolved) return null;
  if (hasUnsupportedColorFunctionInValue(resolved)) return null;
  return resolved.trim();
}

export function getCloneElementNodes(root: Element): Element[] {
  return [root, ...Array.from(root.querySelectorAll("*"))];
}

export function getInlineStyleDeclaration(
  node: Element,
): CSSStyleDeclaration | null {
  const maybeStyle = node as Element & { style?: CSSStyleDeclaration };
  return maybeStyle.style || null;
}

export function getElementClassNameForDiagnostics(node: Element): string {
  const className = (node as Element & { className?: unknown }).className;
  if (typeof className === "string") return className;
  if (className && typeof className === "object" && "baseVal" in className) {
    const baseVal = (className as { baseVal?: unknown }).baseVal;
    return typeof baseVal === "string" ? baseVal : "";
  }
  return "";
}

export function getSafeColorFallback(propertyName: string): string {
  if (
    propertyName === "color" ||
    propertyName === "fill" ||
    propertyName === "stroke"
  ) {
    return "rgb(0, 0, 0)";
  }
  return "transparent";
}

export function sanitizeInlineStylePropertiesInClone(
  inlineStyle: CSSStyleDeclaration,
  resolver: HTMLElement,
  view: Window,
): number {
  let normalizedCount = 0;
  const propertyNames: string[] = [];
  for (let index = 0; index < inlineStyle.length; index += 1) {
    const propertyName = inlineStyle.item(index);
    if (propertyName) propertyNames.push(propertyName);
  }

  propertyNames.forEach((propertyName) => {
    const value = inlineStyle.getPropertyValue(propertyName);
    if (!hasUnsupportedColorFunctionInValue(value)) return;

    if (propertyName.startsWith("--")) {
      inlineStyle.removeProperty(propertyName);
      normalizedCount += 1;
      return;
    }

    const resolved = resolveCssPropertyInClone(
      resolver,
      view,
      propertyName,
      value,
    );
    if (resolved) {
      inlineStyle.setProperty(propertyName, resolved, "important");
      normalizedCount += 1;
      return;
    }

    if (propertyName.includes("background")) {
      inlineStyle.setProperty("background", "none", "important");
      inlineStyle.setProperty(
        "background-color",
        "rgb(255, 255, 255)",
        "important",
      );
      normalizedCount += 1;
      return;
    }
    if (propertyName.includes("border")) {
      inlineStyle.setProperty("border-color", "rgb(0, 0, 0)", "important");
      normalizedCount += 1;
      return;
    }
    if (propertyName === "box-shadow" || propertyName === "filter") {
      inlineStyle.setProperty(propertyName, "none", "important");
      normalizedCount += 1;
      return;
    }

    inlineStyle.setProperty(
      propertyName,
      getSafeColorFallback(propertyName),
      "important",
    );
    normalizedCount += 1;
  });

  return normalizedCount;
}

export function sanitizeUnsupportedColorAttributesInClone(
  node: Element,
  resolver: HTMLElement,
  view: Window,
): number {
  let normalizedCount = 0;
  const inlineStyle = getInlineStyleDeclaration(node);
  const colorAttributeFallbacks: Record<string, string> = {
    color: "rgb(0, 0, 0)",
    fill: "rgb(0, 0, 0)",
    stroke: "rgb(0, 0, 0)",
    "stop-color": "rgb(0, 0, 0)",
    "flood-color": "rgb(0, 0, 0)",
    "lighting-color": "rgb(0, 0, 0)",
  };

  Object.entries(colorAttributeFallbacks).forEach(
    ([attributeName, fallbackValue]) => {
      const rawValue = node.getAttribute(attributeName) || "";
      if (!hasUnsupportedColorFunctionInValue(rawValue)) return;
      node.setAttribute(attributeName, fallbackValue);
      inlineStyle?.setProperty(attributeName, fallbackValue, "important");
      normalizedCount += 1;
    },
  );

  if (inlineStyle) {
    normalizedCount += sanitizeInlineStylePropertiesInClone(
      inlineStyle,
      resolver,
      view,
    );
  }

  return normalizedCount;
}

export function countUnsupportedColorValuesInClone(
  root: HTMLElement,
  view: Window,
): number {
  if (!getPdfDebugEnabled()) return 0;
  const nodes = getCloneElementNodes(root);
  let count = 0;
  nodes.forEach((node) => {
    const computed = view.getComputedStyle(node);
    COLOR_SANITIZE_PROPERTIES.forEach((propertyName) => {
      const value = computed.getPropertyValue(propertyName);
      if (hasUnsupportedColorFunctionInValue(value)) {
        count += 1;
      }
    });

    const computedBackground = computed.getPropertyValue("background");
    if (hasUnsupportedColorFunctionInValue(computedBackground)) {
      count += 1;
    }

    const computedBackgroundImage =
      computed.getPropertyValue("background-image");
    if (hasUnsupportedColorFunctionInValue(computedBackgroundImage)) {
      count += 1;
    }

    const computedBorder = computed.getPropertyValue("border");
    if (hasUnsupportedColorFunctionInValue(computedBorder)) {
      count += 1;
    }

    const inlineStyle = getInlineStyleDeclaration(node);
    const inlineBackground = inlineStyle?.getPropertyValue("background") || "";
    if (hasUnsupportedColorFunctionInValue(inlineBackground)) {
      count += 1;
    }

    const inlineBorder = inlineStyle?.getPropertyValue("border") || "";
    if (hasUnsupportedColorFunctionInValue(inlineBorder)) {
      count += 1;
    }

    const styleAttribute = node.getAttribute("style") || "";
    if (hasUnsupportedColorFunctionInValue(styleAttribute)) {
      count += 1;
    }

    [
      "color",
      "fill",
      "stroke",
      "stop-color",
      "flood-color",
      "lighting-color",
    ].forEach((attributeName) => {
      const attributeValue = node.getAttribute(attributeName) || "";
      if (hasUnsupportedColorFunctionInValue(attributeValue)) {
        count += 1;
      }
    });
  });
  return count;
}

export function collectUnsupportedColorEntriesInClone(
  root: HTMLElement,
  view: Window,
  limit = 10,
): {
  totalCount: number;
  samples: Array<{
    tag: string;
    className: string;
    property: string;
    value: string;
  }>;
} {
  if (!getPdfDebugEnabled()) {
    return { totalCount: 0, samples: [] };
  }
  const nodes = getCloneElementNodes(root);
  const propertiesToCheck = [
    ...COLOR_SANITIZE_PROPERTIES,
    "background",
    "background-image",
    "border",
  ];
  let totalCount = 0;
  const samples: Array<{
    tag: string;
    className: string;
    property: string;
    value: string;
  }> = [];

  nodes.forEach((node) => {
    const computed = view.getComputedStyle(node);
    propertiesToCheck.forEach((propertyName) => {
      const value = computed.getPropertyValue(propertyName);
      if (!hasUnsupportedColorFunctionInValue(value)) return;
      totalCount += 1;
      if (samples.length < limit) {
        samples.push({
          tag: node.tagName.toLowerCase(),
          className: getElementClassNameForDiagnostics(node),
          property: propertyName,
          value,
        });
      }
    });
  });

  return { totalCount, samples };
}

export function sanitizeUnsupportedColorsInClone(
  clonedDoc: Document,
  root: HTMLElement,
): {
  unsupportedColorHitsByProperty: Record<string, number>;
  unsupportedColorElementsCount: number;
  bgModernFlaggedCount: number;
  globalOverridesApplied: boolean;
  normalizedColorsCount: number;
  remainingUnsupportedColorCount: number;
} {
  const view = clonedDoc.defaultView;
  if (!view) {
    return {
      unsupportedColorHitsByProperty: {},
      unsupportedColorElementsCount: 0,
      bgModernFlaggedCount: 0,
      globalOverridesApplied: false,
      normalizedColorsCount: 0,
      remainingUnsupportedColorCount: 0,
    };
  }

  const resolver = clonedDoc.createElement("span");
  resolver.style.position = "fixed";
  resolver.style.left = "-99999px";
  resolver.style.top = "-99999px";
  resolver.style.visibility = "hidden";
  resolver.style.pointerEvents = "none";
  resolver.style.width = "0";
  resolver.style.height = "0";
  clonedDoc.body.appendChild(resolver);

  const unsupportedColorHitsByProperty: Record<string, number> = {};
  const affectedElements = new Set<Element>();
  let bgModernFlaggedCount = 0;
  const globalOverridesApplied = false;
  let normalizedColorsCount = 0;

  const nodes = getCloneElementNodes(root);
  nodes.forEach((node) => {
    const computed = view.getComputedStyle(node);
    const inlineStyle = getInlineStyleDeclaration(node);
    normalizedColorsCount += sanitizeUnsupportedColorAttributesInClone(
      node,
      resolver,
      view,
    );
    COLOR_SANITIZE_PROPERTIES.forEach((propertyName) => {
      const value = computed.getPropertyValue(propertyName);
      if (!hasUnsupportedColorFunctionInValue(value)) return;

      incrementHitCounter(unsupportedColorHitsByProperty, propertyName);
      affectedElements.add(node);
      const resolved = resolveCssPropertyInClone(
        resolver,
        view,
        propertyName,
        value,
      );

      if (resolved) {
        inlineStyle?.setProperty(propertyName, resolved, "important");
      } else if (propertyName === "box-shadow" || propertyName === "filter") {
        inlineStyle?.setProperty(propertyName, "none", "important");
      } else if (propertyName === "color") {
        inlineStyle?.setProperty(propertyName, "rgb(0, 0, 0)", "important");
      } else {
        inlineStyle?.setProperty(propertyName, "transparent", "important");
      }
      normalizedColorsCount += 1;
    });

    const computedBackground = computed.getPropertyValue("background");
    if (hasUnsupportedColorFunctionInValue(computedBackground)) {
      incrementHitCounter(unsupportedColorHitsByProperty, "background");
      affectedElements.add(node);
      const sanitizedBackground =
        sanitizeModernColorFunctionsInText(computedBackground);
      if (
        sanitizedBackground &&
        !hasUnsupportedColorFunctionInValue(sanitizedBackground) &&
        sanitizedBackground !== computedBackground
      ) {
        inlineStyle?.setProperty("background", sanitizedBackground, "important");
        normalizedColorsCount += 1;
      } else {
        inlineStyle?.setProperty("background", "none", "important");
      }
      const fallbackBg = resolveCssPropertyInClone(
        resolver,
        view,
        "background-color",
        computed.getPropertyValue("background-color"),
      );
      inlineStyle?.setProperty(
        "background-color",
        fallbackBg || "rgb(255, 255, 255)",
        "important",
      );
      normalizedColorsCount += 1;
    }

    const inlineBackground = inlineStyle?.getPropertyValue("background") || "";
    if (hasUnsupportedColorFunctionInValue(inlineBackground)) {
      incrementHitCounter(unsupportedColorHitsByProperty, "background");
      affectedElements.add(node);
      const sanitizedBackground =
        sanitizeModernColorFunctionsInText(inlineBackground);
      if (
        sanitizedBackground &&
        !hasUnsupportedColorFunctionInValue(sanitizedBackground) &&
        sanitizedBackground !== inlineBackground
      ) {
        inlineStyle?.setProperty("background", sanitizedBackground, "important");
        normalizedColorsCount += 1;
      } else {
        inlineStyle?.setProperty("background", "none", "important");
      }
      const fallbackBg = resolveCssPropertyInClone(
        resolver,
        view,
        "background-color",
        computed.getPropertyValue("background-color"),
      );
      inlineStyle?.setProperty(
        "background-color",
        fallbackBg || "rgb(255, 255, 255)",
        "important",
      );
      normalizedColorsCount += 1;
    }

    const backgroundImage = computed.getPropertyValue("background-image");
    if (hasUnsupportedColorFunctionInValue(backgroundImage)) {
      incrementHitCounter(unsupportedColorHitsByProperty, "background-image");
      affectedElements.add(node);
      const sanitizedBackgroundImage =
        sanitizeModernColorFunctionsInText(backgroundImage);
      const hasSanitizedBackgroundImage =
        sanitizedBackgroundImage &&
        !hasUnsupportedColorFunctionInValue(sanitizedBackgroundImage) &&
        sanitizedBackgroundImage !== backgroundImage;
      if (hasSanitizedBackgroundImage) {
        inlineStyle?.setProperty(
          "background-image",
          sanitizedBackgroundImage,
          "important",
        );
      } else {
        if (
          node !== root &&
          node !== clonedDoc.body &&
          node !== clonedDoc.documentElement
        ) {
          node.setAttribute(MODERN_BG_ATTRIBUTE, "1");
          bgModernFlaggedCount += 1;
        }
        inlineStyle?.setProperty("background-image", "none", "important");
      }
      const fallbackBg = resolveCssPropertyInClone(
        resolver,
        view,
        "background-color",
        computed.getPropertyValue("background-color"),
      );
      if (fallbackBg) {
        inlineStyle?.setProperty("background-color", fallbackBg, "important");
      } else {
        inlineStyle?.setProperty(
          "background-color",
          "rgb(255, 255, 255)",
          "important",
        );
      }
      normalizedColorsCount += 1;
    }

    const computedBorder = computed.getPropertyValue("border");
    const inlineBorder = inlineStyle?.getPropertyValue("border") || "";
    if (
      hasUnsupportedColorFunctionInValue(computedBorder) ||
      hasUnsupportedColorFunctionInValue(inlineBorder)
    ) {
      incrementHitCounter(unsupportedColorHitsByProperty, "border");
      affectedElements.add(node);
      const topColor =
        resolveCssPropertyInClone(
          resolver,
          view,
          "border-top-color",
          computed.getPropertyValue("border-top-color"),
        ) || "rgb(0, 0, 0)";
      const rightColor =
        resolveCssPropertyInClone(
          resolver,
          view,
          "border-right-color",
          computed.getPropertyValue("border-right-color"),
        ) || topColor;
      const bottomColor =
        resolveCssPropertyInClone(
          resolver,
          view,
          "border-bottom-color",
          computed.getPropertyValue("border-bottom-color"),
        ) || topColor;
      const leftColor =
        resolveCssPropertyInClone(
          resolver,
          view,
          "border-left-color",
          computed.getPropertyValue("border-left-color"),
        ) || rightColor;
      inlineStyle?.setProperty("border-top-color", topColor, "important");
      inlineStyle?.setProperty("border-right-color", rightColor, "important");
      inlineStyle?.setProperty("border-bottom-color", bottomColor, "important");
      inlineStyle?.setProperty("border-left-color", leftColor, "important");
      normalizedColorsCount += 1;
    }
  });

  if (!clonedDoc.head.querySelector(`style[${MODERN_BG_STYLE_ATTRIBUTE}]`)) {
    const fallbackStyle = clonedDoc.createElement("style");
    fallbackStyle.setAttribute(MODERN_BG_STYLE_ATTRIBUTE, "1");
    fallbackStyle.textContent = `[${MODERN_BG_ATTRIBUTE}="1"] { background-image: none !important; }`;
    clonedDoc.head.appendChild(fallbackStyle);
  }

  const remainingUnsupportedColorCount = countUnsupportedColorValuesInClone(
    root,
    view,
  );
  resolver.remove();

  return {
    unsupportedColorHitsByProperty,
    unsupportedColorElementsCount: affectedElements.size,
    bgModernFlaggedCount,
    globalOverridesApplied,
    normalizedColorsCount,
    remainingUnsupportedColorCount,
  };
}
