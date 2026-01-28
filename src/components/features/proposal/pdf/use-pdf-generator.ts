"use client";

import { useState } from "react";
import { Proposal } from "@/services/proposal-service";
import { toast } from "react-toastify";

const getApiBaseUrl = (): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not defined.");
  }
  return apiUrl;
};

interface UsePdfGeneratorProps {
  proposal: Partial<Proposal>;
  setIsOpen: (open: boolean) => void;
}

export function usePdfGenerator({ proposal, setIsOpen }: UsePdfGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Helper function to lighten a hex color (same as in view page)
  // Not strictly needed if not used, but good for consistency.
  // Retaining the core logic for generation.

  const handleGenerate = async (rootElementId?: string) => {
    setIsGenerating(true);
    let iframe: HTMLIFrameElement | null = null;

    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      // Determine root element for scoping
      const rootEl = rootElementId
        ? document.getElementById(rootElementId)
        : document.body;

      if (!rootEl && rootElementId) {
        toast.error("Erro ao localizar conteúdo do PDF");
        return;
      }

      const sourceElement = rootEl; // Use the passed root directly as source

      if (!sourceElement) {
        toast.error("Elemento fonte não encontrado");
        return;
      }

      // --- DEEP FLATTENING HELPERS (Copied from View Page) ---

      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });

      // PIXEL READ STRATEGY: Guarantees RGB with Fallback
      const safeColor = (color: string, propertyName: string = "") => {
        if (!canvasCtx || !color || color === "none") return color;
        // Optimization
        if (color.startsWith("#") || color.startsWith("rgb")) return color;
        if (color === "transparent") return "transparent";

        try {
          canvasCtx.clearRect(0, 0, 1, 1);
          canvasCtx.fillStyle = color;
          canvasCtx.fillRect(0, 0, 1, 1);

          const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data;

          if (a === 0) {
            if (propertyName.toLowerCase() === "color") return "#000000";
            if (
              propertyName.toLowerCase().includes("border") ||
              propertyName.toLowerCase().includes("stroke")
            )
              return "#000000";
          }

          const rgba = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          return rgba;
        } catch {
          if (propertyName.toLowerCase() === "color") return "#000000";
          return "transparent";
        }
      };

      const containsModernColor = (value: string) => {
        return /(lab|oklch|oklab|lch|color)\(/.test(value);
      };

      const deepCloneWithStyles = (node: HTMLElement): HTMLElement => {
        const clone = node.cloneNode(false) as HTMLElement;

        clone.removeAttribute("id");
        clone.removeAttribute("class");

        const computed = window.getComputedStyle(node);

        // COMPREHENSIVE LIST OF PROPERTIES FOR VISUAL FIDELITY
        const propertiesToCopy = [
          // Layout Enforcers (Critical)
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

          // Borders
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

          // Flex & Grid
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

          // Typography
          "font",
          "fontFamily",
          "fontSize",
          "fontWeight",
          "fontStyle",
          "lineHeight",
          "letterSpacing",
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

          // Visuals
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
          "fill",
          "stroke",
          "strokeWidth",
          "objectFit",
          "objectPosition",
          "aspectRatio",
        ];

        propertiesToCopy.forEach((prop) => {
          let val = computed[prop as keyof CSSStyleDeclaration];
          if (!val || typeof val !== "string") return;

          // 1. Sanitize Colors
          if (typeof val === "string") {
            if (
              prop.toLowerCase().includes("color") ||
              prop.toLowerCase() === "fill" ||
              prop.toLowerCase() === "stroke"
            ) {
              val = safeColor(val, prop);
            }
            // 2. Kill Complex Bad Color Strings
            else if (containsModernColor(val)) {
              if (prop.toLowerCase().includes("shadow")) {
                val = "none";
              } else {
                val = "";
              }
            }
          }

          if (val) {
            const kebab = prop
              .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2")
              .toLowerCase();
            clone.style.setProperty(kebab, val, "important");
          }
        });

        // Background Image Sanitize
        if (computed.backgroundImage && computed.backgroundImage !== "none") {
          if (containsModernColor(computed.backgroundImage)) {
            clone.style.backgroundImage = "none";
            clone.style.backgroundColor = safeColor(
              computed.backgroundColor,
              "backgroundColor",
            );
          } else {
            clone.style.backgroundImage = computed.backgroundImage;
          }
        }

        if (node instanceof HTMLImageElement) {
          (clone as HTMLImageElement).src = node.src;
          (clone as HTMLImageElement).loading = "eager";
        }

        // SVG HANDLING
        if (node instanceof SVGElement) {
          const fill = computed.fill;
          const stroke = computed.stroke;
          if (fill && containsModernColor(fill)) {
            clone.style.setProperty(
              "fill",
              safeColor(fill, "fill"),
              "important",
            );
          }
          if (stroke && containsModernColor(stroke)) {
            clone.style.setProperty(
              "stroke",
              safeColor(stroke, "stroke"),
              "important",
            );
          }
        }

        // --- CRITICAL FIX: USE childNodes INSTEAD OF children TO INCLUDE TEXT NODES ---
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            // 1
            clone.appendChild(deepCloneWithStyles(child as HTMLElement));
          } else if (child.nodeType === Node.TEXT_NODE) {
            // 3
            clone.appendChild(child.cloneNode(true));
          } else if (child.nodeType === Node.COMMENT_NODE) {
            // Ignore comments
          } else {
            // Clone other types (like CDATA) just in case
            clone.appendChild(child.cloneNode(true));
          }
        });

        return clone;
      };

      // --- EXECUTION (IFRAME ISOLATION) ---

      iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
      iframe.style.width = "210mm";
      iframe.style.height = "297mm";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      if (!iframe.contentDocument || !iframe.contentWindow) {
        throw new Error("Iframe could not be created");
      }

      const iframeDoc = iframe.contentDocument;

      // --- 1. FONT INJECTION ---
      const styleElement = iframeDoc.createElement("style");
      let fontFaceRules = "";

      try {
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            Array.from(sheet.cssRules).forEach((rule) => {
              if (rule.type === CSSRule.FONT_FACE_RULE) {
                let ruleText = rule.cssText;
                ruleText = ruleText.replace(
                  /url\((['"]?)\//g,
                  `url($1${window.location.origin}/`,
                );
                fontFaceRules += ruleText + "\n";
              }
            });
          } catch {
            // Ignore
          }
        });
      } catch (e) {
        console.warn("Could not copy fonts", e);
      }

      styleElement.textContent = fontFaceRules;
      iframeDoc.head.appendChild(styleElement);

      // --- 2. CLONE & INSERT ---
      const clonedElement = deepCloneWithStyles(sourceElement);

      // Reset margins
      clonedElement.style.margin = "0";
      clonedElement.style.marginLeft = "0";
      clonedElement.style.marginRight = "0";
      clonedElement.style.marginTop = "0";
      clonedElement.style.marginBottom = "0";
      clonedElement.style.boxShadow = "none";
      clonedElement.style.transform = "none";

      const container = iframeDoc.createElement("div");
      container.style.width = "210mm";
      container.style.minWidth = "210mm";
      container.style.maxWidth = "210mm";
      container.style.backgroundColor = "#ffffff";
      container.appendChild(clonedElement);

      iframeDoc.body.style.margin = "0";
      iframeDoc.body.style.padding = "0";
      iframeDoc.body.appendChild(container);

      // --- 3. WAIT ---
      try {
        await iframeDoc.fonts.ready;
      } catch (e) {
        console.warn("Font loading wait failed", e);
      }

      // --- 4. PROXY ---
      const images = Array.from(container.querySelectorAll("img"));
      if (images.length > 0) {
        const apiBaseUrl = getApiBaseUrl();

        const uniqueUrls = new Set(
          images
            .map((img) => img.src)
            .filter((src) => src && !src.startsWith("data:")),
        );

        const urlMap = new Map<string, string>();

        await Promise.all(
          Array.from(uniqueUrls).map(async (url) => {
            try {
              const proxyUrl = `${apiBaseUrl}/v1/aux/proxy-image?url=${encodeURIComponent(url)}`;
              const response = await fetch(proxyUrl);
              if (response.ok) {
                const blob = await response.blob();
                const reader = new FileReader();
                const dataUrl = await new Promise<string>((resolve) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                urlMap.set(url, dataUrl);
              }
            } catch {
              console.warn("Failed to proxy image:", url);
            }
          }),
        );

        images.forEach((img) => {
          if (urlMap.has(img.src)) {
            img.src = urlMap.get(img.src)!;
          }
        });

        await Promise.all(
          images.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) resolve();
                else {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                }
              }),
          ),
        );

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // --- 5. RENDER EACH PAGE INDIVIDUALLY ---
      // IMPORTANT: In the list view, the sourceElement (wrapper) contains ProposalPdfViewer
      // which renders .pdf-page-container items. We need to find them INSIDE the cloned element.
      // Note: deepCloneWithStyles removes classes, so we must use data attributes.
      const pageContainers = container.querySelectorAll("[data-page-index]");

      if (pageContainers.length === 0) {
        toast.error("Erro: Nenhuma página encontrada para gerar PDF");
        return;
      }

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;

      // Capture and add each page individually
      for (let i = 0; i < pageContainers.length; i++) {
        const pageElement = pageContainers[i] as HTMLElement;

        // Capture this specific page
        const pageCanvas = await html2canvas(pageElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: "#ffffff",
          width: 794, // Fixed A4 width
          height: 1123, // Fixed A4 height
        });

        // Add page to PDF (add new page for all except first)
        if (i > 0) {
          pdf.addPage();
        }

        // Add the page image to fill the entire PDF page
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          0,
          pageWidth,
          pageHeight,
        );
      }

      const filename = `proposta-${proposal?.title?.toLowerCase().replace(/\s+/g, "-") || "comercial"}.pdf`;
      pdf.save(filename);

      if (setIsOpen) setIsOpen(false);
      toast.success("PDF baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF: Cores não suportadas detectadas.");
      if (setIsOpen) setIsOpen(false);
    } finally {
      if (document.body.contains(iframe!)) {
        document.body.removeChild(iframe!);
      }
      setIsGenerating(false);
    }
  };

  return { isGenerating, handleGenerate };
}
