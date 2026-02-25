import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX } from "@/utils/pdf-layout";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  CAPTURE_TARGET_ATTR,
  DEFAULT_SCALE,
  FORCED_HTML2CANVAS_SCALE,
} from "./render-to-pdf.constants";
import {
  buildProposalPdfFilename,
  createDebugLogger,
  getApiBaseUrl,
  getPdfDebugEnabled,
} from "./render-to-pdf.helpers";
import {
  CaptureDomPreparation,
  RenderToPdfOptions,
  RenderToPdfResult,
} from "./render-to-pdf.types";
import {
  collectProductLayoutDiagnostics,
  collectTextDebugSamples,
  createLayoutSnapshot,
  getCaptureTargetSelector,
  getElementRectSnapshot,
  getPageRectDiagnostics,
  inspectCanvasBlank,
  summarizeLayoutDiff,
  summarizeProductLayoutDiagnostics,
  summarizeTextDebugDiffs,
} from "./render-to-pdf.diagnostics";
import {
  addCaptureModeStyle,
  assertOriginalImagesIntact,
  collectFontRequirements,
  createOriginalImageSnapshot,
  ensureSourceImagesReady,
  getRootDescriptor,
  getRootImageCount,
  hashBuffer,
  loadAndStabilizeFonts,
  prepareCloneForCapture,
  prepareDomForPdfCapture,
  restoreOriginalImagesFromSnapshot,
  waitForLayoutStability,
  waitForRaf,
} from "./render-to-pdf.core";
import { injectModernColorFallbacksFromStylesheets } from "./render-to-pdf.capture-utils";

export type {
  RenderToPdfOptions,
  RenderToPdfResult,
} from "./render-to-pdf.types";
export async function renderToPdf({
  rootElement,
  rootHint,
  proposalTitle,
  tenantId,
  sourceLabel = "download",
  apiBaseUrl,
  scale: _scaleUnused = DEFAULT_SCALE,
}: RenderToPdfOptions): Promise<RenderToPdfResult> {
  void _scaleUnused;
  const baseCaptureScale = FORCED_HTML2CANVAS_SCALE;
  const debugEnabled = getPdfDebugEnabled();
  const log = createDebugLogger();
  const startedAt = performance.now();

  const html2canvas = (await import("html2canvas")).default;
  const jsPDF = (await import("jspdf")).default;

  const rootDescriptor = getRootDescriptor(rootElement);
  const captureTargetSelector = getCaptureTargetSelector(rootElement);
  const rootImagesCount = getRootImageCount(rootElement);
  const originalImageSnapshot = createOriginalImageSnapshot(
    rootElement,
    Math.max(rootImagesCount, 1),
  );
  const sourceLayoutSnapshot = debugEnabled
    ? createLayoutSnapshot(rootElement, 5)
    : null;
  const sourceTextDebugSamples = debugEnabled
    ? collectTextDebugSamples(rootElement)
    : [];
  const sourceProductLayoutDiagnostics = debugEnabled
    ? collectProductLayoutDiagnostics(rootElement)
    : [];

  log("start", {
    sourceLabel,
    rootHint: rootHint || rootDescriptor,
    rootDescriptor,
    rootImagesCount,
    scale: baseCaptureScale,
  });
  log("source layout snapshot", {
    sourceLabel,
    rootHint: rootHint || rootDescriptor,
    snapshot: sourceLayoutSnapshot,
  });
  log("source text diagnostics", {
    sourceLabel,
    rootHint: rootHint || rootDescriptor,
    samples: sourceTextDebugSamples,
  });
  log("source product row diagnostics", {
    sourceLabel,
    rootHint: rootHint || rootDescriptor,
    samples: sourceProductLayoutDiagnostics,
  });

  const fastMode = !debugEnabled;
  await ensureSourceImagesReady(rootElement, log);

  let prepared: CaptureDomPreparation | null = null;
  let captureStyle: HTMLStyleElement | null = null;
  const previousCaptureTargetAttribute =
    rootElement.getAttribute(CAPTURE_TARGET_ATTR);
  rootElement.setAttribute(CAPTURE_TARGET_ATTR, "1");

  try {
    prepared = prepareDomForPdfCapture(rootElement);
    captureStyle = addCaptureModeStyle(document);

    await waitForRaf();
    await waitForRaf();

    const fontRequirements = collectFontRequirements(rootElement);
    const fontResult = await loadAndStabilizeFonts(
      document,
      fontRequirements,
      log,
      fastMode,
    );

    if (!fastMode) {
      await waitForLayoutStability(rootElement, log);
    }
    if (debugEnabled) {
      log("capture target diagnostics (original)", {
        captureTargetSelector,
        captureTargetSnippet: (rootElement.outerHTML || "").slice(0, 200),
        rootRect: getElementRectSnapshot(rootElement),
        pageMetrics: getPageRectDiagnostics(rootElement),
        pageCountInTarget:
          rootElement.querySelectorAll("[data-page-index]").length,
      });
      const captureLayoutSnapshot = createLayoutSnapshot(rootElement, 5);
      const captureTextDebugSamples = collectTextDebugSamples(
        rootElement,
        sourceTextDebugSamples.map((sample) => sample.key),
      );
      const captureProductLayoutDiagnostics =
        collectProductLayoutDiagnostics(rootElement);
      log("capture layout snapshot", {
        sourceLabel,
        rootHint: rootHint || rootDescriptor,
        snapshot: captureLayoutSnapshot,
      });
      log("capture text diagnostics", {
        sourceLabel,
        rootHint: rootHint || rootDescriptor,
        samples: captureTextDebugSamples,
      });
      if (sourceLayoutSnapshot) {
        log("source vs capture layout diff", {
          sourceLabel,
          rootHint: rootHint || rootDescriptor,
          diff: summarizeLayoutDiff(sourceLayoutSnapshot, captureLayoutSnapshot),
        });
      }
      log("source vs capture text diff", {
        sourceLabel,
        rootHint: rootHint || rootDescriptor,
        diff: summarizeTextDebugDiffs(
          sourceTextDebugSamples,
          captureTextDebugSamples,
        ),
      });
      log("capture product row diagnostics", {
        sourceLabel,
        rootHint: rootHint || rootDescriptor,
        samples: captureProductLayoutDiagnostics,
      });
      log("source vs capture product row diff", {
        sourceLabel,
        rootHint: rootHint || rootDescriptor,
        diff: summarizeProductLayoutDiagnostics(
          sourceProductLayoutDiagnostics,
          captureProductLayoutDiagnostics,
        ),
      });
    }

    log("root image diagnostics", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      rootDescriptor,
      note: "clone-level diagnostics logged per page during onclone",
    });

    const pageElements = Array.from(
      rootElement.querySelectorAll<HTMLElement>("[data-page-index]"),
    );

    if (pageElements.length === 0) {
      throw new Error("Nenhuma página foi encontrada para renderizar o PDF.");
    }

    log("page diagnostics", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      pageElementsCount: pageElements.length,
    });

    const captureScale =
      pageElements.length >= 30
        ? 1.0
        : pageElements.length >= 20
          ? 1.15
          : pageElements.length >= 12
            ? 1.3
          : baseCaptureScale;

    const pdf = new jsPDF("p", "mm", "a4");
    const canvasSizes: Array<{ width: number; height: number }> = [];
    const html2CanvasOptions = {
      scale: captureScale,
      useCORS: true,
      logging: false,
      allowTaint: false,
      backgroundColor: "#ffffff",
      width: PAGE_WIDTH_PX,
      height: PAGE_HEIGHT_PX,
      windowWidth: PAGE_WIDTH_PX,
      windowHeight: PAGE_HEIGHT_PX,
    };
    log("html2canvas options", {
      ...html2CanvasOptions,
      letterRendering: "not-set",
      foreignObjectRendering: "not-set",
    });

    const captureProxyOptions = {
      apiBaseUrl: getApiBaseUrl(apiBaseUrl),
      tenantId,
      disableCache: process.env.NODE_ENV !== "production" && debugEnabled,
    };
    const aggregateUnsupportedColorHitsByProperty: Record<string, number> = {};
    let aggregateUnsupportedColorElementsCount = 0;
    let aggregateBgModernFlaggedCount = 0;
    let aggregateGlobalOverridesApplied = false;
    let aggregateNormalizedColorsCount = 0;
    let aggregateRemainingUnsupportedColorCount = 0;
    let blankCanvasPages = 0;
    let aggregateTotalImages = 0;
    let aggregateDecodedImages = 0;
    let aggregateFailedImages = 0;
    let aggregateProxiedImagesCount = 0;
    let aggregateProxiedBackgroundImagesCount = 0;
    let aggregateDirectRemoteImageRequestsCount = 0;
    let aggregateImageWaitMs = 0;
    const handleClone = async (
      clonedDoc: Document,
      pageIndex: number,
      pageIndexAttr: string,
      aggressiveColorSanitization = false,
    ) => {
      // Replace modern color functions that html2canvas may fail to parse.
      injectModernColorFallbacksFromStylesheets(clonedDoc);
      const overrideStyle = clonedDoc.createElement("style");
      overrideStyle.innerHTML =
        "* { text-rendering: optimizeSpeed !important; font-variant-ligatures: none !important; }";
      clonedDoc.head.appendChild(overrideStyle);
      const scopedPageSelector = `${captureTargetSelector} [data-page-index="${pageIndexAttr}"]`;
      const captureSelector = clonedDoc.querySelector(scopedPageSelector)
        ? scopedPageSelector
        : captureTargetSelector;
      const cloneStats = await prepareCloneForCapture(
        clonedDoc,
        captureProxyOptions,
        captureSelector,
        log,
        aggressiveColorSanitization,
      );
      Object.entries(cloneStats.unsupportedColorHitsByProperty).forEach(
        ([propertyName, count]) => {
          aggregateUnsupportedColorHitsByProperty[propertyName] =
            (aggregateUnsupportedColorHitsByProperty[propertyName] || 0) +
            count;
        },
      );
      aggregateUnsupportedColorElementsCount +=
        cloneStats.unsupportedColorElementsCount;
      aggregateBgModernFlaggedCount += cloneStats.bgModernFlaggedCount;
      aggregateGlobalOverridesApplied =
        aggregateGlobalOverridesApplied || cloneStats.globalOverridesApplied;
      aggregateNormalizedColorsCount += cloneStats.normalizedColorsCount;
      aggregateRemainingUnsupportedColorCount +=
        cloneStats.remainingUnsupportedColorCount;
      aggregateTotalImages += cloneStats.totalImages;
      aggregateDecodedImages += cloneStats.decodedImages;
      aggregateFailedImages += cloneStats.failedImages;
      aggregateProxiedImagesCount += cloneStats.proxiedImagesCount;
      aggregateProxiedBackgroundImagesCount +=
        cloneStats.proxiedBackgroundImagesCount;
      aggregateDirectRemoteImageRequestsCount +=
        cloneStats.directRemoteImageRequestsCount;
      aggregateImageWaitMs += cloneStats.imageWaitMs;
      log("clone capture diagnostics", {
        pageIndex,
        captureTargetSelector: cloneStats.captureTargetSelector,
        captureTargetSnippet: cloneStats.captureTargetSnippet,
        captureTargetRect: cloneStats.captureTargetRect,
        captureTargetPages: cloneStats.captureTargetPages,
        pageCountInTarget: cloneStats.captureTargetPages.length,
        visibleNodeCount: cloneStats.visibleNodeCount,
        unsupportedColorHitsByProperty: cloneStats.unsupportedColorHitsByProperty,
        unsupportedColorElementsCount: cloneStats.unsupportedColorElementsCount,
        bgModernFlaggedCount: cloneStats.bgModernFlaggedCount,
        globalOverridesApplied: cloneStats.globalOverridesApplied,
        normalizedColorsCount: cloneStats.normalizedColorsCount,
        remainingUnsupportedColorCount:
          cloneStats.remainingUnsupportedColorCount,
        proxiedImagesCount: cloneStats.proxiedImagesCount,
        proxiedBackgroundImagesCount: cloneStats.proxiedBackgroundImagesCount,
        directRemoteImageRequestsCount:
          cloneStats.directRemoteImageRequestsCount,
      });
      return cloneStats;
    };

    for (let pageIndex = 0; pageIndex < pageElements.length; pageIndex += 1) {
      const pageElement = pageElements[pageIndex];
      const pageIndexAttr =
        pageElement.getAttribute("data-page-index") || String(pageIndex);
      let latestCloneErrorDiagnostics: unknown = null;
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(pageElement, {
          ...html2CanvasOptions,
          onclone: async (clonedDoc) => {
            const cloneStatsFromHandle = await handleClone(
              clonedDoc,
              pageIndex,
              pageIndexAttr,
            );
            latestCloneErrorDiagnostics = {
              pageIndex,
              remainingUnsupportedColorCount:
                cloneStatsFromHandle.remainingUnsupportedColorCount,
              unsupportedColorHitsByProperty:
                cloneStatsFromHandle.unsupportedColorHitsByProperty,
            };
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isUnsupportedModernColorError =
          /unsupported color function/i.test(errorMessage) &&
          /\b(lab|oklch|oklab|lch|color-mix)\b/i.test(errorMessage);
        if (isUnsupportedModernColorError) {
          log("retrying html2canvas with foreignObjectRendering", {
            pageIndex,
            errorMessage,
          });
          canvas = await html2canvas(pageElement, {
            ...html2CanvasOptions,
            foreignObjectRendering: true,
            onclone: async (clonedDoc) => {
              const cloneStats = await handleClone(
                clonedDoc,
                pageIndex,
                pageIndexAttr,
                true,
              );
              latestCloneErrorDiagnostics = {
                pageIndex,
                remainingUnsupportedColorCount:
                  cloneStats.remainingUnsupportedColorCount,
                unsupportedColorHitsByProperty:
                  cloneStats.unsupportedColorHitsByProperty,
              };
            },
          });
        } else {
          const originalView = pageElement.ownerDocument.defaultView;
          const originalComputed = originalView
            ? originalView.getComputedStyle(pageElement)
            : null;
          log("html2canvas error diagnostics", {
            pageIndex,
            errorMessage,
            note: "html2canvas parseBackgroundColor value is not directly exposed; logging nearest CSS candidates",
            originalPageElementStyles: {
              background: originalComputed?.getPropertyValue("background") || "",
              backgroundImage:
                originalComputed?.getPropertyValue("background-image") || "",
              backgroundColor:
                originalComputed?.getPropertyValue("background-color") || "",
              border: originalComputed?.getPropertyValue("border") || "",
            },
            cloneDiagnostics: latestCloneErrorDiagnostics,
          });
          throw error;
        }
      }

      const blankInspection = inspectCanvasBlank(canvas);
      if (blankInspection.isBlankCanvas) {
        blankCanvasPages += 1;
      }
      log("canvas diagnostics", {
        pageIndex,
        width: canvas.width,
        height: canvas.height,
        isBlankCanvas: blankInspection.isBlankCanvas,
        pixelSamples: blankInspection.samples,
      });

      canvasSizes.push({ width: canvas.width, height: canvas.height });

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        canvas,
        "JPEG",
        0,
        0,
        A4_WIDTH_MM,
        A4_HEIGHT_MM,
        undefined,
        "FAST",
      );
    }

    log("clone capture aggregate diagnostics", {
      unsupportedColorHitsByProperty: aggregateUnsupportedColorHitsByProperty,
      unsupportedColorElementsCount: aggregateUnsupportedColorElementsCount,
      bgModernFlaggedCount: aggregateBgModernFlaggedCount,
      globalOverridesApplied: aggregateGlobalOverridesApplied,
      remainingUnsupportedColorCount: aggregateRemainingUnsupportedColorCount,
      directRemoteImageRequestsCount: aggregateDirectRemoteImageRequestsCount,
      blankCanvasPages,
    });

    const blob = pdf.output("blob");
    // Hashing large PDFs adds noticeable latency before download starts.
    // Keep this expensive diagnostics path only when pdf debug is enabled.
    const arrayBuffer = debugEnabled ? await blob.arrayBuffer() : new ArrayBuffer(0);
    const hashHex = debugEnabled ? await hashBuffer(arrayBuffer) : "";
    const durationMs = Math.round(performance.now() - startedAt);

    const result: RenderToPdfResult = {
      blob,
      arrayBuffer,
      filename: buildProposalPdfFilename(proposalTitle),
      pageCount: pageElements.length,
      canvasSizes,
      blobSize: blob.size,
      hashHex,
      metrics: {
        sourceLabel,
        rootHint: rootHint || rootDescriptor,
        rootDescriptor,
        pageElementsCount: pageElements.length,
        rootImagesCount,
        fontsReadyMs: fontResult.elapsedMs,
        fontsTimeout: fontResult.fontsTimeout,
        fontRequirements,
        totalImages: aggregateTotalImages,
        decodedImages: aggregateDecodedImages,
        failedImages: aggregateFailedImages,
        proxiedImagesCount: aggregateProxiedImagesCount,
        proxiedBackgroundImagesCount: aggregateProxiedBackgroundImagesCount,
        directRemoteImageRequestsCount: aggregateDirectRemoteImageRequestsCount,
        unsupportedColorHitsByProperty: aggregateUnsupportedColorHitsByProperty,
        unsupportedColorElementsCount: aggregateUnsupportedColorElementsCount,
        bgModernFlaggedCount: aggregateBgModernFlaggedCount,
        globalOverridesApplied: aggregateGlobalOverridesApplied,
        normalizedColorsCount: aggregateNormalizedColorsCount,
        remainingUnsupportedColorCount: aggregateRemainingUnsupportedColorCount,
        blankCanvasPages,
        imageWaitMs: aggregateImageWaitMs,
        durationMs,
      },
    };

    log("pdf result", {
      ...result.metrics,
      blobSize: result.blobSize,
      hashHex: result.hashHex,
      canvasSizes: result.canvasSizes,
    });

    return result;
  } finally {
    if (previousCaptureTargetAttribute === null) {
      rootElement.removeAttribute(CAPTURE_TARGET_ATTR);
    } else {
      rootElement.setAttribute(
        CAPTURE_TARGET_ATTR,
        previousCaptureTargetAttribute,
      );
    }
    captureStyle?.remove();
    prepared?.cleanup();
    restoreOriginalImagesFromSnapshot(rootElement, originalImageSnapshot, log);
    assertOriginalImagesIntact(rootElement, originalImageSnapshot, log);
  }
}

export function savePdfBlob(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}

