"use client";

import { useState } from "react";
import { ProposalPdfSettings } from "@/types";
import { Proposal } from "@/services/proposal-service";
import { toast } from "react-toastify";
import { PAGE_WIDTH_PX, PAGE_HEIGHT_PX } from "@/utils/pdf-layout";

// API base URL for proxy-image
const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "https://api-2lumykmdwa-rj.a.run.app";
};

interface UsePdfGeneratorProps {
  proposal: Partial<Proposal>;
  settings: ProposalPdfSettings;
  includeCover: boolean;
  setIsOpen: (open: boolean) => void;
}

export function usePdfGenerator({
  proposal,
  settings,
  includeCover,
  setIsOpen,
}: UsePdfGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Proxies all images in a container by replacing their src with base64 data
   * fetched via REST API to bypass CORS.
   */
  const processImages = async (container: HTMLElement): Promise<void> => {
    const images = Array.from(container.querySelectorAll("img"));
    const apiBaseUrl = getApiBaseUrl();

    // Filter unique URLs to avoid duplicate fetches
    const uniqueUrls = new Set(
      images
        .map((img) => img.src)
        .filter((src) => src && !src.startsWith("data:"))
    );

    const urlMap = new Map<string, string>();

    // Fetch all unique images in parallel using REST API
    await Promise.all(
      Array.from(uniqueUrls).map(async (url) => {
        try {
          // Use the REST API proxy endpoint
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
        } catch (error) {
          console.error("[PDF Debug] Failed to proxy image:", url, error);
          toast.error(
            `Falha ao carregar imagem para PDF: ${url.substring(0, 30)}...`
          );
        }
      })
    );

    // Apply base64 data to images
    images.forEach((img) => {
      img.loading = "eager";
      if (urlMap.has(img.src)) {
        img.src = urlMap.get(img.src)!;
      }
    });

    // Wait for images to be "ready" in the DOM
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );

    // Extra safety wait for rendering
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;

      // Container for off-screen rendering
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "210mm";
      document.body.appendChild(container);

      let isFirstPage = true;

      // Wait for fonts to load
      await document.fonts.ready;

      try {
        // 1. Handle Cover
        if (includeCover) {
          const coverEl = document.getElementById("pdf-cover-page");
          if (coverEl) {
            const clonedCover = coverEl.cloneNode(true) as HTMLElement;
            clonedCover.style.width = `${PAGE_WIDTH_PX}px`;
            clonedCover.style.height = `${PAGE_HEIGHT_PX}px`;
            clonedCover.style.margin = "0";
            clonedCover.style.padding = "0";

            container.appendChild(clonedCover);
            await processImages(clonedCover);

            const canvas = await html2canvas(clonedCover, {
              scale: 2,
              useCORS: true,
              logging: false,
              allowTaint: true,
              backgroundColor: "#ffffff",
              scrollY: 0,
            });

            if (!isFirstPage) pdf.addPage();
            pdf.addImage(
              canvas.toDataURL("image/jpeg", 0.95),
              "JPEG",
              0,
              0,
              210,
              297
            );
            isFirstPage = false;

            container.removeChild(clonedCover);
          }
        }

        // 2. Handle Content Pages
        const sourceEl = document.getElementById("proposal-pdf-source");
        if (sourceEl) {
          const clonedSource = sourceEl.cloneNode(true) as HTMLElement;
          clonedSource.style.width = `${PAGE_WIDTH_PX}px`;
          clonedSource.style.margin = "0";
          clonedSource.style.padding = "0";

          container.appendChild(clonedSource);
          await processImages(clonedSource);

          // Find all page containers
          const pages = clonedSource.querySelectorAll(".pdf-page-container");

          if (pages.length > 0) {
            for (let i = 0; i < pages.length; i++) {
              const pageEl = pages[i] as HTMLElement;
              pageEl.style.width = `${PAGE_WIDTH_PX}px`;
              pageEl.style.height = `${PAGE_HEIGHT_PX}px`;
              pageEl.style.margin = "0";
              pageEl.style.boxShadow = "none";
              pageEl.style.transform = "none";
              pageEl.style.backgroundColor = "#ffffff";

              const canvas = await html2canvas(pageEl, {
                scale: 2,
                useCORS: true,
                logging: false,
                allowTaint: true,
                backgroundColor: "#ffffff",
                width: PAGE_WIDTH_PX,
                height: PAGE_HEIGHT_PX,
                windowWidth: PAGE_WIDTH_PX,
                windowHeight: PAGE_HEIGHT_PX,
                scrollY: 0,
              });

              if (!isFirstPage) pdf.addPage();
              pdf.addImage(
                canvas.toDataURL("image/jpeg", 0.95),
                "JPEG",
                0,
                0,
                210,
                297
              );
              isFirstPage = false;
            }
          } else {
            // Fallback: Render as single block
            const canvas = await html2canvas(clonedSource, {
              scale: 2,
              useCORS: true,
              logging: false,
              allowTaint: true,
              backgroundColor: "#ffffff",
            });

            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            if (!isFirstPage) pdf.addPage();
            pdf.addImage(
              canvas.toDataURL("image/jpeg", 0.95),
              "JPEG",
              0,
              position,
              imgWidth,
              imgHeight
            );
            heightLeft -= pageHeight;

            while (heightLeft > 1) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(
                canvas.toDataURL("image/jpeg", 0.95),
                "JPEG",
                0,
                position,
                imgWidth,
                imgHeight
              );
              heightLeft -= pageHeight;
            }
          }

          container.removeChild(clonedSource);
        }
      } finally {
        document.body.removeChild(container);
      }

      // Download
      const title = proposal.title || "comercial";
      const filename = `proposta-${title
        .toLowerCase()
        .replace(/\s+/g, "-")}.pdf`;
      pdf.save(filename);
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    handleGenerate,
  };
}
