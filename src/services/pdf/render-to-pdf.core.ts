import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX } from "@/utils/pdf-layout";
import {
  extractConcreteFontFamilies,
  normalizePdfFontFamily,
} from "@/services/pdf/pdf-fonts";
import {
  CAPTURE_MODE_CLASS,
  COLOR_STYLE_FIELDS,
  FONT_READY_TIMEOUT_MS,
  IMAGE_DECODE_TIMEOUT_MS,
  TRANSPARENT_PIXEL_DATA_URL,
} from "./render-to-pdf.constants";
import {
  areLayoutSnapshotsStable,
  areNumberArraysStable,
  countVisibleNodes,
  createLayoutSnapshot,
  findDebugTextTargets,
  getElementRectSnapshot,
  getPageRectDiagnostics,
} from "./render-to-pdf.diagnostics";
import {
  buildProxyImageUrl,
  buildUnsupportedColorFunctionFlags,
  collectUnsupportedColorEntriesInClone,
  containsModernColor,
  hasUnsupportedColorFunction,
  hasUnsupportedColorFunctionInValue,
  isCrossOriginHttpUrl,
  isHttpUrl,
  normalizeStyle,
  normalizeWeight,
  replaceBackgroundUrlsWithProxy,
  safeCssColor,
  sanitizeUnsupportedColorsInClone,
  toKebabCase,
} from "./render-to-pdf.capture-utils";
import {
  CaptureDomPreparation,
  CloneCapturePreparationStats,
  ColorNormalizationResult,
  DebugLogger,
  FontRequirement,
  ImageDebugEntry,
  ImageLoadResult,
  LayoutSnapshot,
  OriginalImageSnapshot,
} from "./render-to-pdf.types";
export function isCrossOriginHttpUrlForDocument(doc: Document, rawUrl: string): boolean {
  const view = doc.defaultView;
  if (!view) return false;
  try {
    const parsed = new URL(rawUrl, view.location.href);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    return isHttp && parsed.origin !== view.location.origin;
  } catch {
    return false;
  }
}

export function countDirectRemoteImageRequestsInClone(root: HTMLElement, clonedDoc: Document): number {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  const imageCount = images.filter((image) => {
    const effective = getImageEffectiveSrc(image);
    if (!isCrossOriginHttpUrlForDocument(clonedDoc, effective)) return false;
    return !effective.includes("/v1/aux/proxy-image");
  }).length;

  const srcsetCount = images.filter((image) => {
    const srcset = image.getAttribute("srcset") || "";
    return srcset.includes("http://") || srcset.includes("https://");
  }).length;

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  let backgroundCount = 0;
  let inlineStyleCount = 0;
  nodes.forEach((node) => {
    const computedBackgroundImage = (clonedDoc.defaultView?.getComputedStyle(node).backgroundImage || "").trim();
    if (computedBackgroundImage.includes("url(")) {
      const matches = computedBackgroundImage.matchAll(/url\((['"]?)(.*?)\1\)/gi);
      for (const match of matches) {
        const rawUrl = (match[2] || "").trim();
        if (
          isCrossOriginHttpUrlForDocument(clonedDoc, rawUrl) &&
          !rawUrl.includes("/v1/aux/proxy-image")
        ) {
          backgroundCount += 1;
        }
      }
    }

    const inlineStyle = node.getAttribute("style") || "";
    if (inlineStyle.includes("url(")) {
      const matches = inlineStyle.matchAll(/url\((['"]?)(.*?)\1\)/gi);
      for (const match of matches) {
        const rawUrl = (match[2] || "").trim();
        if (
          isCrossOriginHttpUrlForDocument(clonedDoc, rawUrl) &&
          !rawUrl.includes("/v1/aux/proxy-image")
        ) {
          inlineStyleCount += 1;
        }
      }
    }
  });

  return imageCount + srcsetCount + backgroundCount + inlineStyleCount;
}

export async function waitForCloneImageReady(image: HTMLImageElement): Promise<boolean> {
  if (isImageLoaded(image)) return true;
  try {
    if (typeof image.decode === "function") {
      await waitWithTimeout(image.decode(), IMAGE_DECODE_TIMEOUT_MS);
    } else {
      await waitWithTimeout(
        new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        }),
        IMAGE_DECODE_TIMEOUT_MS,
      );
    }
  } catch {
    // no-op
  }
  return isImageLoaded(image);
}

export async function prepareCloneForCapture(
  clonedDoc: Document,
  options: { apiBaseUrl: string; tenantId?: string; disableCache: boolean },
  captureTargetSelector: string,
  log?: DebugLogger,
): Promise<CloneCapturePreparationStats> {
  const root = clonedDoc.querySelector<HTMLElement>(captureTargetSelector) || clonedDoc.body;
  if (!root) {
    return {
      captureTargetSelector,
      captureTargetSnippet: "",
      captureTargetRect: null,
      captureTargetPages: [],
      visibleNodeCount: 0,
      totalImages: 0,
      decodedImages: 0,
      failedImages: 0,
      proxiedImagesCount: 0,
      proxiedBackgroundImagesCount: 0,
      directRemoteImageRequestsCount: 0,
      unsupportedColorHitsByProperty: {},
      unsupportedColorElementsCount: 0,
      bgModernFlaggedCount: 0,
      globalOverridesApplied: false,
      normalizedColorsCount: 0,
      remainingUnsupportedColorCount: 0,
      imageWaitMs: 0,
    };
  }

  const cloneView = clonedDoc.defaultView;
  const cloneHtml = clonedDoc.documentElement;
  const cloneBody = clonedDoc.body;
  let globalOverridesApplied = false;

  const snapshotBackground = (element: HTMLElement | null) => {
    if (!element || !cloneView) {
      return {
        background: "",
        backgroundImage: "",
        flags: buildUnsupportedColorFunctionFlags(""),
      };
    }
    const computed = cloneView.getComputedStyle(element);
    const background = computed.getPropertyValue("background");
    const backgroundImage = computed.getPropertyValue("background-image");
    return {
      background,
      backgroundImage,
      flags: {
        ...buildUnsupportedColorFunctionFlags(background),
        imageHasUnsupported: hasUnsupportedColorFunctionInValue(backgroundImage),
      },
    };
  };

  const preSanitizeHtml = snapshotBackground(cloneHtml);
  const preSanitizeBody = snapshotBackground(cloneBody);
  const preSanitizeRoot = snapshotBackground(root);
  log?.("clone background diagnostics before sanitize", {
    html: preSanitizeHtml,
    body: preSanitizeBody,
    captureRoot: preSanitizeRoot,
    explicitRequiredFields: {
      cloneBodyBackground: preSanitizeBody.background,
      cloneBodyBackgroundImage: preSanitizeBody.backgroundImage,
      cloneHtmlBackground: preSanitizeHtml.background,
      captureRootBackground: preSanitizeRoot.background,
    },
  });

  const applyRootBackgroundFailsafe = (element: HTMLElement | null) => {
    if (!element) return;
    element.style.setProperty("background", "none", "important");
    element.style.setProperty("background-color", "#ffffff", "important");
    globalOverridesApplied = true;
  };
  applyRootBackgroundFailsafe(cloneHtml);
  applyRootBackgroundFailsafe(cloneBody);
  applyRootBackgroundFailsafe(root);

  const colorStats = sanitizeUnsupportedColorsInClone(clonedDoc, root);
  const captureTargetRect = getElementRectSnapshot(root);
  const captureTargetPages = getPageRectDiagnostics(root);
  const visibleNodeCount = cloneView ? countVisibleNodes(root, cloneView) : 0;
  const captureTargetSnippet = (root.outerHTML || "").slice(0, 200);

  let remainingUnsupportedColorCount = colorStats.remainingUnsupportedColorCount;
  if (cloneView) {
    const postSanitizeHtml = snapshotBackground(cloneHtml);
    const postSanitizeBody = snapshotBackground(cloneBody);
    const postSanitizeRoot = snapshotBackground(root);
    const unsupportedEntries = collectUnsupportedColorEntriesInClone(root, cloneView, 10);
    remainingUnsupportedColorCount = unsupportedEntries.totalCount;

    log?.("clone background diagnostics after sanitize", {
      html: postSanitizeHtml,
      body: postSanitizeBody,
      captureRoot: postSanitizeRoot,
      remainingUnsupportedColorCount: unsupportedEntries.totalCount,
    });

    if (unsupportedEntries.totalCount > 0) {
      log?.("clone unsupported color survivors", {
        remainingUnsupportedColorCount: unsupportedEntries.totalCount,
        first10: unsupportedEntries.samples,
      });
    }
  }

  const preloadLinks = Array.from(
    clonedDoc.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"][href]'),
  );
  preloadLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (isCrossOriginHttpUrlForDocument(clonedDoc, href)) {
      link.remove();
    }
  });

  const pictureSources = Array.from(clonedDoc.querySelectorAll<HTMLSourceElement>("picture source"));
  pictureSources.forEach((source) => {
    source.removeAttribute("srcset");
    source.removeAttribute("sizes");
  });

  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  let proxiedImagesCount = 0;
  images.forEach((image, index) => {
    const effectiveSource = getImageEffectiveSrc(image) || image.getAttribute("src") || "";
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.loading = "eager";
    image.decoding = "sync";

    if (!effectiveSource || !isCrossOriginHttpUrlForDocument(clonedDoc, effectiveSource)) {
      return;
    }

    const proxied = buildProxyImageUrl(effectiveSource, { ...options, index });
    image.src = proxied;
    proxiedImagesCount += 1;
  });

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  let proxiedBackgroundImagesCount = 0;
  nodes.forEach((node) => {
    const computedBackgroundImage =
      clonedDoc.defaultView?.getComputedStyle(node).backgroundImage || "";
    if (!computedBackgroundImage.includes("url(")) return;
    const replaced = replaceBackgroundUrlsWithProxy(computedBackgroundImage, options);
    if (replaced.replacedCount <= 0) return;
    node.style.setProperty("background-image", replaced.value, "important");
    proxiedBackgroundImagesCount += replaced.replacedCount;
  });

  const inlineWithHttp = Array.from(
    root.querySelectorAll<HTMLElement>('[style*="http://"], [style*="https://"]'),
  );
  inlineWithHttp.forEach((node) => {
    const current = node.style.getPropertyValue("background-image");
    if (!current || !current.includes("url(")) return;
    const replaced = replaceBackgroundUrlsWithProxy(current, options);
    if (replaced.replacedCount <= 0) return;
    node.style.setProperty("background-image", replaced.value, "important");
    proxiedBackgroundImagesCount += replaced.replacedCount;
  });

  const forcedProxyImages = Array.from(
    root.querySelectorAll<HTMLImageElement>('img[src^="http://"], img[src^="https://"], img[srcset*="http"]'),
  );
  forcedProxyImages.forEach((image, index) => {
    const rawSrc = image.getAttribute("src") || image.currentSrc || image.src || "";
    if (
      rawSrc &&
      isCrossOriginHttpUrlForDocument(clonedDoc, rawSrc) &&
      !rawSrc.includes("/v1/aux/proxy-image")
    ) {
      image.src = buildProxyImageUrl(rawSrc, { ...options, index: images.length + index });
      proxiedImagesCount += 1;
    }
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.loading = "eager";
    image.decoding = "sync";
  });

  const startedAt = performance.now();
  const settled = await Promise.all(images.map((image) => waitForCloneImageReady(image)));
  const imageWaitMs = Math.round(performance.now() - startedAt);
  const decodedImages = settled.filter(Boolean).length;
  const failedImages = settled.length - decodedImages;

  const directRemoteImageRequestsCount = countDirectRemoteImageRequestsInClone(root, clonedDoc);
  return {
    captureTargetSelector,
    captureTargetSnippet,
    captureTargetRect,
    captureTargetPages,
    visibleNodeCount,
    totalImages: images.length,
    decodedImages,
    failedImages,
    proxiedImagesCount,
    proxiedBackgroundImagesCount,
    directRemoteImageRequestsCount,
    unsupportedColorHitsByProperty: colorStats.unsupportedColorHitsByProperty,
    unsupportedColorElementsCount: colorStats.unsupportedColorElementsCount,
    bgModernFlaggedCount: colorStats.bgModernFlaggedCount,
    globalOverridesApplied: colorStats.globalOverridesApplied || globalOverridesApplied,
    normalizedColorsCount: colorStats.normalizedColorsCount,
    remainingUnsupportedColorCount,
    imageWaitMs,
  };
}

export function countDirectRemoteImageRequests(container: HTMLElement): number {
  const imageCount = Array.from(container.querySelectorAll<HTMLImageElement>("img")).filter((img) => {
    const effective = getImageEffectiveSrc(img);
    return isCrossOriginHttpUrl(effective);
  }).length;

  const nodes = [container, ...Array.from(container.querySelectorAll<HTMLElement>("*"))];
  let backgroundCount = 0;
  nodes.forEach((node) => {
    const backgroundImage = window.getComputedStyle(node).backgroundImage || "";
    if (!backgroundImage.includes("url(")) return;
    const matches = backgroundImage.matchAll(/url\((['"]?)(.*?)\1\)/gi);
    for (const match of matches) {
      const rawUrl = (match[2] || "").trim();
      if (isCrossOriginHttpUrl(rawUrl)) {
        backgroundCount += 1;
      }
    }
  });

  return imageCount + backgroundCount;
}

export function countRemainingUnsupportedColors(root: HTMLElement): number {
  let count = 0;
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  nodes.forEach((node) => {
    const computed = window.getComputedStyle(node);
    COLOR_STYLE_FIELDS.forEach((field) => {
      const value = computed[field];
      if (typeof value === "string" && hasUnsupportedColorFunction(value)) {
        count += 1;
      }
    });

    const backgroundImage = computed.backgroundImage || "";
    if (hasUnsupportedColorFunction(backgroundImage)) {
      count += 1;
    }
  });
  return count;
}

export function normalizeUnsupportedColorsForCapture(
  root: HTMLElement,
  log: DebugLogger,
): ColorNormalizationResult {
  const cleanupTasks: Array<() => void> = [];
  let normalizedColorsCount = 0;

  const resolver = root.ownerDocument.createElement("span");
  resolver.style.position = "fixed";
  resolver.style.left = "-99999px";
  resolver.style.top = "-99999px";
  resolver.style.visibility = "hidden";
  resolver.style.pointerEvents = "none";
  resolver.style.width = "0";
  resolver.style.height = "0";
  root.ownerDocument.body.appendChild(resolver);
  cleanupTasks.push(() => resolver.remove());

  const resolveToRgb = (rawValue: string): string | null => {
    if (!rawValue) return null;
    resolver.style.color = "";
    resolver.style.color = rawValue;
    const resolved = window.getComputedStyle(resolver).color;
    if (!resolved || hasUnsupportedColorFunction(resolved)) return null;
    return resolved;
  };

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  nodes.forEach((node) => {
    const computed = window.getComputedStyle(node);

    COLOR_STYLE_FIELDS.forEach((field) => {
      const value = computed[field];
      if (typeof value !== "string" || !hasUnsupportedColorFunction(value)) return;

      const cssField = toKebabCase(field);
      const resolved = resolveToRgb(value);
      if (!resolved) return;

      const previousValue = node.style.getPropertyValue(cssField);
      const previousPriority = node.style.getPropertyPriority(cssField);
      cleanupTasks.push(() => {
        if (previousValue) {
          node.style.setProperty(cssField, previousValue, previousPriority || "");
        } else {
          node.style.removeProperty(cssField);
        }
      });

      node.style.setProperty(cssField, resolved, "important");
      normalizedColorsCount += 1;
    });

    const backgroundImage = computed.backgroundImage || "";
    if (hasUnsupportedColorFunction(backgroundImage)) {
      const previousBackgroundImage = node.style.getPropertyValue("background-image");
      const previousBackgroundImagePriority = node.style.getPropertyPriority("background-image");
      const previousBackgroundColor = node.style.getPropertyValue("background-color");
      const previousBackgroundColorPriority = node.style.getPropertyPriority("background-color");
      const fallbackBackground = resolveToRgb(computed.backgroundColor || "") || "rgba(255, 255, 255, 1)";

      cleanupTasks.push(() => {
        if (previousBackgroundImage) {
          node.style.setProperty(
            "background-image",
            previousBackgroundImage,
            previousBackgroundImagePriority || "",
          );
        } else {
          node.style.removeProperty("background-image");
        }

        if (previousBackgroundColor) {
          node.style.setProperty(
            "background-color",
            previousBackgroundColor,
            previousBackgroundColorPriority || "",
          );
        } else {
          node.style.removeProperty("background-color");
        }
      });

      node.style.setProperty("background-image", "none", "important");
      node.style.setProperty("background-color", fallbackBackground, "important");
      normalizedColorsCount += 1;
    }
  });

  const remainingUnsupportedColorCount = countRemainingUnsupportedColors(root);
  log("unsupported color normalization", {
    normalizedColorsCount,
    remainingUnsupportedColorCount,
  });

  return {
    normalizedColorsCount,
    remainingUnsupportedColorCount,
    cleanup: () => {
      while (cleanupTasks.length > 0) {
        const task = cleanupTasks.pop();
        if (!task) continue;
        try {
          task();
        } catch {
          // no-op
        }
      }
    },
  };
}

export function normalizeImageForCapture(image: HTMLImageElement): void {
  image.loading = "eager";
  image.decoding = "sync";
  image.fetchPriority = "high";
  image.crossOrigin = "anonymous";
}

export function createOriginalImageSnapshot(
  rootElement: HTMLElement,
  maxImages = 5,
): OriginalImageSnapshot[] {
  const images = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img")).slice(0, maxImages);
  return images.map((image, index) => ({
    index,
    src: image.src || "",
    srcset: image.srcset || "",
    sizes: image.sizes || "",
    loading: image.loading || "",
    decoding: image.decoding || "",
    crossOrigin: image.crossOrigin,
  }));
}

export function assertOriginalImagesIntact(
  rootElement: HTMLElement,
  before: OriginalImageSnapshot[],
  log: DebugLogger,
): void {
  if (before.length === 0) return;

  const after = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img"))
    .slice(0, before.length)
    .map((image, index) => ({
      index,
      src: image.src || "",
      srcset: image.srcset || "",
      sizes: image.sizes || "",
      loading: image.loading || "",
      decoding: image.decoding || "",
      crossOrigin: image.crossOrigin,
    }));

  const changed = before.filter((entry, index) => {
    const target = after[index];
    if (!target) return true;
    return (
      entry.src !== target.src ||
      entry.srcset !== target.srcset ||
      entry.sizes !== target.sizes ||
      entry.loading !== target.loading ||
      entry.decoding !== target.decoding ||
      entry.crossOrigin !== target.crossOrigin
    );
  });

  log("ui integrity check", {
    checkedImages: before.length,
    changedImages: changed.length,
    changed,
  });
}

export function restoreOriginalImagesFromSnapshot(
  rootElement: HTMLElement,
  before: OriginalImageSnapshot[],
  log: DebugLogger,
): void {
  if (before.length === 0) return;

  const images = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img")).slice(0, before.length);
  images.forEach((image, index) => {
    const snapshot = before[index];
    if (!snapshot) return;

    if (image.src !== snapshot.src) image.src = snapshot.src;
    if (image.srcset !== snapshot.srcset) image.srcset = snapshot.srcset;
    if (image.sizes !== snapshot.sizes) image.sizes = snapshot.sizes;
    if (image.loading !== snapshot.loading) image.loading = snapshot.loading as HTMLImageElement["loading"];
    if (image.decoding !== snapshot.decoding)
      image.decoding = snapshot.decoding as HTMLImageElement["decoding"];
    if ((image.crossOrigin || null) !== snapshot.crossOrigin) {
      image.crossOrigin = snapshot.crossOrigin;
    }
  });

  log("ui restore fallback executed", { restoredImages: images.length });
}

export function getImageEffectiveSrc(image: HTMLImageElement): string {
  return image.currentSrc || image.src || "";
}

export function getImageCaptureSource(image: HTMLImageElement): string {
  return (
    image.getAttribute("data-pdf-original-current-src") ||
    image.getAttribute("data-pdf-original-src") ||
    getImageEffectiveSrc(image)
  );
}

export function isImageLoaded(image: HTMLImageElement): boolean {
  if (!image.complete) return false;
  if (image.naturalWidth > 0) return true;
  return image.src.startsWith("data:image");
}

export function getImageDebugEntry(image: HTMLImageElement, index: number): ImageDebugEntry {
  const effectiveSrc = getImageEffectiveSrc(image);
  const captureSource = getImageCaptureSource(image);
  return {
    index,
    src: image.src || "",
    currentSrc: effectiveSrc,
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    loading: image.loading,
    isDataUrl: effectiveSrc.startsWith("data:"),
    isBlobUrl: effectiveSrc.startsWith("blob:"),
    isProxyUrl: effectiveSrc.includes("/v1/aux/proxy-image"),
    captureSource,
  };
}

export async function waitForRaf(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function ensureSourceImagesReady(rootElement: HTMLElement, log: DebugLogger): Promise<void> {
  const sourceImages = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img"));
  if (sourceImages.length === 0) return;

  await Promise.all(
    sourceImages.map(async (image) => {
      if (isImageLoaded(image)) return;

      try {
        if (typeof image.decode === "function") {
          await waitWithTimeout(image.decode(), IMAGE_DECODE_TIMEOUT_MS);
        } else {
          await waitWithTimeout(
            new Promise<void>((resolve) => {
              const done = () => resolve();
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
            }),
            IMAGE_DECODE_TIMEOUT_MS,
          );
        }
      } catch {
        log("source image decode failed", { src: image.src, currentSrc: image.currentSrc });
      }
    }),
  );
}

export function collectReferenceTextWidths(root: HTMLElement, max = 3): number[] {
  const candidates = findDebugTextTargets(root, max);
  return candidates.map((element) => Number(element.getBoundingClientRect().width.toFixed(2)));
}

export async function waitForLayoutStability(root: HTMLElement, log: DebugLogger): Promise<void> {
  const maxAttempts = 10;
  let previous: LayoutSnapshot | null = null;
  let previousWidths: number[] | null = null;
  let stableFrames = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await waitForRaf();
    const current = createLayoutSnapshot(root, 5);
    const currentWidths = collectReferenceTextWidths(root, 3);

    const isStableLayout = previous && areLayoutSnapshotsStable(previous, current);
    const isStableTextWidths =
      previousWidths && areNumberArraysStable(previousWidths, currentWidths);

    if (isStableLayout && isStableTextWidths) {
      stableFrames += 1;
      if (stableFrames >= 2) {
        log("layout settled", {
          attempt,
          stableFrames,
          snapshot: current,
          referenceTextWidths: currentWidths,
        });
        return;
      }
    } else {
      stableFrames = 0;
    }

    previous = current;
    previousWidths = currentWidths;
  }

  log("layout settle timeout", {
    attempts: maxAttempts,
    snapshot: previous,
    referenceTextWidths: previousWidths,
  });
}

export function deepCloneWithComputedStyles(
  node: HTMLElement,
  canvasCtx: CanvasRenderingContext2D | null,
): HTMLElement {
  const clone = node.cloneNode(false) as HTMLElement;
  clone.removeAttribute("id");
  clone.removeAttribute("class");

  const computed = window.getComputedStyle(node);
  const propertiesToCopy = [
    "display",
    "position",
    "boxSizing",
    "top",
    "left",
    "right",
    "bottom",
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "margin",
    "marginTop",
    "marginBottom",
    "marginLeft",
    "marginRight",
    "padding",
    "paddingTop",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "borderTopWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopStyle",
    "borderBottomStyle",
    "borderLeftStyle",
    "borderRightStyle",
    "borderTopColor",
    "borderBottomColor",
    "borderLeftColor",
    "borderRightColor",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomLeftRadius",
    "borderBottomRightRadius",
    "outline",
    "outlineColor",
    "outlineStyle",
    "outlineWidth",
    "flex",
    "flexDirection",
    "flexWrap",
    "justifyContent",
    "alignItems",
    "alignContent",
    "gap",
    "order",
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "gridTemplateColumns",
    "gridTemplateRows",
    "gridTemplateAreas",
    "gridAutoColumns",
    "gridAutoRows",
    "gridAutoFlow",
    "gridColumn",
    "gridRow",
    "gridArea",
    "columnGap",
    "rowGap",
    "font",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontStretch",
    "fontKerning",
    "fontFeatureSettings",
    "fontVariantLigatures",
    "lineHeight",
    "letterSpacing",
    "wordSpacing",
    "textRendering",
    "textAlign",
    "textTransform",
    "textDecoration",
    "textDecorationColor",
    "textUnderlineOffset",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
    "textOverflow",
    "verticalAlign",
    "color",
    "backgroundColor",
    "opacity",
    "visibility",
    "zIndex",
    "boxShadow",
    "overflow",
    "overflowX",
    "overflowY",
    "transform",
    "transformOrigin",
    "zoom",
    "fill",
    "stroke",
    "strokeWidth",
    "objectFit",
    "objectPosition",
    "aspectRatio",
    "breakInside",
  ];

  propertiesToCopy.forEach((propertyName) => {
    let value = computed[propertyName as keyof CSSStyleDeclaration];
    if (!value || typeof value !== "string") return;

    if (
      propertyName.toLowerCase().includes("color") ||
      propertyName === "fill" ||
      propertyName === "stroke"
    ) {
      value = safeCssColor(value, canvasCtx, propertyName);
    } else if (containsModernColor(value)) {
      value = propertyName.toLowerCase().includes("shadow") ? "none" : "";
    }

    if (value) {
      clone.style.setProperty(toKebabCase(propertyName), value, "important");
    }
  });

  if (computed.backgroundImage && computed.backgroundImage !== "none") {
    if (containsModernColor(computed.backgroundImage)) {
      clone.style.backgroundImage = "none";
      clone.style.backgroundColor = safeCssColor(
        computed.backgroundColor,
        canvasCtx,
        "backgroundColor",
      );
    } else {
      clone.style.backgroundImage = computed.backgroundImage;
    }
  }

  if (node instanceof HTMLImageElement) {
    const sourceImage = node as HTMLImageElement;
    const cloneImage = clone as HTMLImageElement;
    const srcToUse = getImageEffectiveSrc(sourceImage);

    cloneImage.src = TRANSPARENT_PIXEL_DATA_URL;
    cloneImage.removeAttribute("srcset");
    cloneImage.sizes = "";
    normalizeImageForCapture(cloneImage);
    cloneImage.setAttribute("data-pdf-original-src", sourceImage.src || srcToUse);
    cloneImage.setAttribute("data-pdf-original-current-src", srcToUse);
    if (sourceImage.srcset) cloneImage.setAttribute("data-pdf-original-srcset", sourceImage.srcset);
    if (sourceImage.sizes) cloneImage.setAttribute("data-pdf-original-sizes", sourceImage.sizes);
  }

  Array.from(node.childNodes).forEach((childNode) => {
    if (childNode.nodeType === Node.ELEMENT_NODE) {
      clone.appendChild(
        deepCloneWithComputedStyles(childNode as HTMLElement, canvasCtx),
      );
      return;
    }
    clone.appendChild(childNode.cloneNode(true));
  });

  return clone;
}

export function applyCaptureLayoutFixes(
  root: HTMLElement,
  cleanupTasks: Array<() => void>,
): void {
  // Intentionally no-op; layout is normalized by capture-mode CSS rules.
  void root;
  void cleanupTasks;
}

export function prepareDomForPdfCapture(root: HTMLElement): CaptureDomPreparation {
  const cleanupTasks: Array<() => void> = [];
  root.classList.add(CAPTURE_MODE_CLASS);
  cleanupTasks.push(() => root.classList.remove(CAPTURE_MODE_CLASS));

  const pageElements = Array.from(
    root.querySelectorAll<HTMLElement>("[data-page-index]"),
  );
  pageElements.forEach((pageEl) => {
    const previousStyle = pageEl.getAttribute("style");
    cleanupTasks.push(() => {
      if (previousStyle === null) pageEl.removeAttribute("style");
      else pageEl.setAttribute("style", previousStyle);
    });

    pageEl.style.setProperty("width", `${PAGE_WIDTH_PX}px`, "important");
    pageEl.style.setProperty("min-width", `${PAGE_WIDTH_PX}px`, "important");
    pageEl.style.setProperty("max-width", `${PAGE_WIDTH_PX}px`, "important");
    pageEl.style.setProperty("height", `${PAGE_HEIGHT_PX}px`, "important");
    pageEl.style.setProperty("min-height", `${PAGE_HEIGHT_PX}px`, "important");
    pageEl.style.setProperty("max-height", `${PAGE_HEIGHT_PX}px`, "important");
    pageEl.style.setProperty("box-shadow", "none", "important");
    pageEl.style.setProperty("break-inside", "avoid", "important");
    pageEl.style.setProperty("page-break-inside", "avoid", "important");
    pageEl.style.setProperty("contain", "layout paint", "important");
  });

  const overrideSelectors = [
    "[data-pdf-margin-bottom]",
    "[data-pdf-margin-top]",
    "[data-pdf-padding-bottom]",
    "[data-pdf-padding-top]",
    "[data-pdf-height]",
    "[data-pdf-border-top]",
  ];

  overrideSelectors.forEach((selector) => {
    root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const previousStyle = el.getAttribute("style");
      cleanupTasks.push(() => {
        if (previousStyle === null) el.removeAttribute("style");
        else el.setAttribute("style", previousStyle);
      });

      const marginBottom = el.getAttribute("data-pdf-margin-bottom");
      if (marginBottom)
        el.style.setProperty("margin-bottom", marginBottom, "important");
      const marginTop = el.getAttribute("data-pdf-margin-top");
      if (marginTop) el.style.setProperty("margin-top", marginTop, "important");
      const paddingBottom = el.getAttribute("data-pdf-padding-bottom");
      if (paddingBottom)
        el.style.setProperty("padding-bottom", paddingBottom, "important");
      const paddingTop = el.getAttribute("data-pdf-padding-top");
      if (paddingTop) el.style.setProperty("padding-top", paddingTop, "important");
      const height = el.getAttribute("data-pdf-height");
      if (height) {
        el.style.setProperty("height", height, "important");
        el.style.setProperty("min-height", height, "important");
        el.style.setProperty("line-height", height, "important");
      }
      const borderTop = el.getAttribute("data-pdf-border-top");
      if (borderTop) {
        el.style.setProperty("border-top-width", borderTop, "important");
        el.style.setProperty("border-top-style", "solid", "important");
        el.style.setProperty("border-top-color", "transparent", "important");
        el.style.setProperty("height", "0px", "important");
      }
    });
  });

  applyCaptureLayoutFixes(root, cleanupTasks);

  return {
    root,
    cleanup: () => {
      while (cleanupTasks.length > 0) {
        cleanupTasks.pop()?.();
      }
    },
  };
}

export function addCaptureModeStyle(doc: Document): HTMLStyleElement {
  const style = doc.createElement("style");
  style.textContent = `
    .${CAPTURE_MODE_CLASS},
    .${CAPTURE_MODE_CLASS} * {
      transition: none !important;
      animation: none !important;
    }
    .${CAPTURE_MODE_CLASS} [data-page-index] {
      width: ${PAGE_WIDTH_PX}px !important;
      height: ${PAGE_HEIGHT_PX}px !important;
      min-width: ${PAGE_WIDTH_PX}px !important;
      min-height: ${PAGE_HEIGHT_PX}px !important;
      max-width: ${PAGE_WIDTH_PX}px !important;
      max-height: ${PAGE_HEIGHT_PX}px !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-item-extra-tag] {
      margin-top: 0 !important;
      top: auto !important;
      line-height: 0 !important;
      transform: translateY(3px) !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-ambiente-pill] {
      line-height: 0 !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-system-title] {
      margin: 0 !important;
      display: block !important;
      transform: translateY(-2px) !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-system-head] {
      transform: translateY(-4px) !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-ambiente-list] {
      margin-top: 10px !important;
      padding-top: 0 !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-item-extra-tag] svg,
    .${CAPTURE_MODE_CLASS} [data-pdf-ambiente-pill] svg {
      display: block !important;
    }
  `;
  doc.head.appendChild(style);
  return style;
}

export function collectFontRequirements(root: HTMLElement): FontRequirement[] {
  const requirements = new Map<string, FontRequirement>();
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  elements.forEach((element) => {
    const computed = window.getComputedStyle(element);
    const normalizedFamily = normalizePdfFontFamily(computed.fontFamily || "");
    const families = extractConcreteFontFamilies(normalizedFamily);
    const weight = normalizeWeight(computed.fontWeight || "400");
    const style = normalizeStyle(computed.fontStyle || "normal");

    families.forEach((family) => {
      const key = `${family}|${weight}|${style}`;
      if (!requirements.has(key)) {
        requirements.set(key, { family, weight, style });
      }
    });
  });

  return Array.from(requirements.values());
}

export async function loadAndStabilizeFonts(
  doc: Document,
  requirements: FontRequirement[],
  log: DebugLogger,
): Promise<{ elapsedMs: number; fontsTimeout: boolean }> {
  const startedAt = performance.now();
  const fontSet = doc.fonts;
  if (!fontSet || requirements.length === 0) {
    return { elapsedMs: 0, fontsTimeout: false };
  }

  await fontSet.ready.catch(() => undefined);
  await Promise.allSettled(
    requirements.map((entry) =>
      fontSet.load(`${entry.style} ${entry.weight} 16px "${entry.family}"`),
    ),
  );

  const probe = doc.createElement("span");
  probe.textContent = "mmmmmmmmmWWWWWW000000";
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  probe.style.top = "-9999px";
  probe.style.fontSize = "36px";
  probe.style.whiteSpace = "nowrap";
  doc.body.appendChild(probe);

  const timeoutAt = startedAt + FONT_READY_TIMEOUT_MS;
  let fontsTimeout = false;

  while (performance.now() < timeoutAt) {
    const allReady = requirements.every((entry) => {
      const checkQuery = `${entry.style} ${entry.weight} 16px "${entry.family}"`;
      const isChecked = fontSet.check(checkQuery);

      probe.style.fontFamily = `"${entry.family}", monospace`;
      probe.style.fontWeight = String(entry.weight);
      probe.style.fontStyle = entry.style;
      const widthWithFamily = probe.getBoundingClientRect().width;
      const heightWithFamily = probe.getBoundingClientRect().height;

      probe.style.fontFamily = "monospace";
      probe.style.fontWeight = "400";
      probe.style.fontStyle = "normal";
      const widthFallback = probe.getBoundingClientRect().width;
      const heightFallback = probe.getBoundingClientRect().height;

      const hasMetricDiff =
        Math.abs(widthWithFamily - widthFallback) > 0.1 ||
        Math.abs(heightWithFamily - heightFallback) > 0.1;

      return isChecked && hasMetricDiff;
    });

    if (allReady) break;
    await new Promise((resolve) => window.setTimeout(resolve, 60));
  }

  if (performance.now() >= timeoutAt) {
    fontsTimeout = true;
  }

  probe.remove();
  const elapsedMs = Math.round(performance.now() - startedAt);

  log("font stabilization", {
    elapsedMs,
    fontsTimeout,
    requirements,
  });

  return { elapsedMs, fontsTimeout };
}

export function applyImagePlaceholder(image: HTMLImageElement): void {
  const rect = image.getBoundingClientRect();
  if (!image.style.width && rect.width > 0) {
    image.style.width = `${rect.width}px`;
  }
  if (!image.style.height && rect.height > 0) {
    image.style.height = `${rect.height}px`;
  }
  image.src = TRANSPARENT_PIXEL_DATA_URL;
  image.removeAttribute("srcset");
  image.sizes = "";
}

export async function proxyAndLoadImages(
  container: HTMLElement,
  options: { apiBaseUrl: string; tenantId?: string; disableCache: boolean },
  log: DebugLogger,
): Promise<ImageLoadResult> {
  const startedAt = performance.now();
  const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
  const before = images.map((img, index) => getImageDebugEntry(img, index));
  const cleanupTasks: Array<() => void> = [];

  const backgroundNodes = [container, ...Array.from(container.querySelectorAll<HTMLElement>("*"))];
  let proxiedBackgroundImagesCount = 0;
  backgroundNodes.forEach((node) => {
    const computedBackgroundImage = window.getComputedStyle(node).backgroundImage || "";
    if (!computedBackgroundImage || !computedBackgroundImage.includes("url(")) return;

    const replaced = replaceBackgroundUrlsWithProxy(computedBackgroundImage, options);
    if (replaced.replacedCount <= 0) return;

    proxiedBackgroundImagesCount += replaced.replacedCount;
    const previousValue = node.style.getPropertyValue("background-image");
    const previousPriority = node.style.getPropertyPriority("background-image");
    cleanupTasks.push(() => {
      if (previousValue) {
        node.style.setProperty("background-image", previousValue, previousPriority || "");
      } else {
        node.style.removeProperty("background-image");
      }
    });
    node.style.setProperty("background-image", replaced.value, "important");
  });

  if (images.length === 0) {
    const directRemoteImageRequestsCount = countDirectRemoteImageRequests(container);
    return {
      totalImages: 0,
      decodedImages: 0,
      failedImages: 0,
      proxiedImagesCount: 0,
      proxiedBackgroundImagesCount,
      directRemoteImageRequestsCount,
      waitMs: 0,
      before,
      after: [],
      cleanup: () => {
        while (cleanupTasks.length > 0) {
          const task = cleanupTasks.pop();
          if (!task) continue;
          task();
        }
      },
    };
  }

  images.forEach((image) => normalizeImageForCapture(image));

  const uniqueSourceUrls = new Set(
    images
      .map((image) => getImageCaptureSource(image))
      .filter(
        (src) =>
          src &&
          !src.startsWith("data:") &&
          !src.startsWith("blob:") &&
          !src.startsWith("about:") &&
          isHttpUrl(src),
      ),
  );

  const proxiedMap = new Map<string, string>();
  let proxiedImagesCount = 0;

  Array.from(uniqueSourceUrls).forEach((rawUrl, index) => {
    if (!isCrossOriginHttpUrl(rawUrl)) {
      return;
    }

    proxiedMap.set(
      rawUrl,
      buildProxyImageUrl(rawUrl, {
        ...options,
        index,
      }),
    );
  });

  images.forEach((image) => {
    const previousSrc = image.getAttribute("src");
    const previousSrcset = image.getAttribute("srcset");
    const previousSizes = image.getAttribute("sizes");
    const previousLoading = image.getAttribute("loading");
    const previousDecoding = image.getAttribute("decoding");
    const previousCrossOrigin = image.getAttribute("crossorigin");
    cleanupTasks.push(() => {
      if (previousSrc === null) image.removeAttribute("src");
      else image.setAttribute("src", previousSrc);
      if (previousSrcset === null) image.removeAttribute("srcset");
      else image.setAttribute("srcset", previousSrcset);
      if (previousSizes === null) image.removeAttribute("sizes");
      else image.setAttribute("sizes", previousSizes);
      if (previousLoading === null) image.removeAttribute("loading");
      else image.setAttribute("loading", previousLoading);
      if (previousDecoding === null) image.removeAttribute("decoding");
      else image.setAttribute("decoding", previousDecoding);
      if (previousCrossOrigin === null) image.removeAttribute("crossorigin");
      else image.setAttribute("crossorigin", previousCrossOrigin);
    });

    const captureSource = getImageCaptureSource(image);
    const proxied = proxiedMap.get(captureSource);
    if (proxied) {
      image.crossOrigin = "anonymous";
      image.loading = "eager";
      image.decoding = "sync";
      image.src = proxied;
      image.removeAttribute("srcset");
      image.sizes = "";
      proxiedImagesCount += 1;
    } else if (captureSource && !captureSource.startsWith("about:")) {
      image.crossOrigin = "anonymous";
      image.loading = "eager";
      image.decoding = "sync";
      image.src = captureSource;
      image.removeAttribute("srcset");
      image.sizes = "";
    }
  });

  let decodedImages = 0;
  let failedImages = 0;

  await Promise.all(
    images.map(async (image, index) => {
      if (isImageLoaded(image)) {
        decodedImages += 1;
        return;
      }

      let status: "ok" | "error" | "timeout" = "ok";
      try {
        if (typeof image.decode === "function") {
          await waitWithTimeout(image.decode(), IMAGE_DECODE_TIMEOUT_MS);
        } else {
          await waitWithTimeout(
            new Promise<void>((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
            }),
            IMAGE_DECODE_TIMEOUT_MS,
          );
        }
      } catch (error) {
        status = error instanceof Error && error.message === "timeout" ? "timeout" : "error";
      }

      if (isImageLoaded(image)) {
        decodedImages += 1;
      } else {
        failedImages += 1;
        applyImagePlaceholder(image);
      }

      const entry = getImageDebugEntry(image, index);
      entry.decodeStatus = status === "ok" && isImageLoaded(image) ? "ok" : status;
      log("image decode status", entry);
    }),
  );

  const after = images.map((img, index) => getImageDebugEntry(img, index));
  const waitMs = Math.round(performance.now() - startedAt);
  const directRemoteImageRequestsCount = countDirectRemoteImageRequests(container);

  return {
    totalImages: images.length,
    decodedImages,
    failedImages,
    proxiedImagesCount,
    proxiedBackgroundImagesCount,
    directRemoteImageRequestsCount,
    waitMs,
    before,
    after,
    cleanup: () => {
      while (cleanupTasks.length > 0) {
        const task = cleanupTasks.pop();
        if (!task) continue;
        task();
      }
    },
  };
}

export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  if (!crypto?.subtle) return "";
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getRootDescriptor(rootElement: HTMLElement): string {
  if (rootElement.id) return `#${rootElement.id}`;
  const className = rootElement.className?.toString().trim();
  if (className) return `${rootElement.tagName.toLowerCase()}.${className.split(/\s+/)[0]}`;
  return rootElement.tagName.toLowerCase();
}

export function getRootImageCount(rootElement: HTMLElement): number {
  return rootElement.querySelectorAll("img").length;
}


