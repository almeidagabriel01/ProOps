"use client";

import { useState } from "react";
import { ProposalPdfSettings } from "@/types";
import { Proposal } from "@/services/proposal-service";

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
   * Preloads all images in a container by converting them to data URLs.
   * This fixes issues with html2canvas not properly rendering cross-origin images
   * from Firebase Storage even with useCORS: true.
   */
  const preloadImages = async (container: HTMLElement): Promise<void> => {
    const images = container.querySelectorAll("img");
    const imagePromises: Promise<void>[] = [];

    images.forEach((img) => {
      const src = img.src;
      if (!src || src.startsWith("data:")) return;

      const promise = new Promise<void>((resolve) => {
        // Create an image element to load the image
        const tempImg = new Image();
        tempImg.crossOrigin = "anonymous";

        tempImg.onload = () => {
          try {
            // Create a canvas to convert to data URL
            const canvas = document.createElement("canvas");
            canvas.width = tempImg.naturalWidth;
            canvas.height = tempImg.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(tempImg, 0, 0);
              // Replace the image src with data URL
              const dataUrl = canvas.toDataURL("image/png");
              img.src = dataUrl;
            }
          } catch (e) {
            console.warn("Failed to convert image to data URL:", src, e);
          }
          resolve();
        };

        tempImg.onerror = () => {
          console.warn("Failed to load image:", src);
          resolve();
        };

        tempImg.src = src;
      });

      imagePromises.push(promise);
    });

    await Promise.all(imagePromises);
    // Give a small delay for DOM to update
    await new Promise((resolve) => setTimeout(resolve, 100));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      // Dynamic imports to reduce bundle size
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;

      // Generate cover page if enabled
      if (includeCover) {
        const coverElement = document.getElementById("pdf-cover-page");
        if (coverElement) {
          // Preload all images in cover before rendering
          await preloadImages(coverElement);

          const canvas = await html2canvas(coverElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: null,
            onclone: (clonedDoc) => {
              const allElements = clonedDoc.querySelectorAll("*");
              allElements.forEach((el) => {
                const element = el as HTMLElement;
                const computedStyle = window.getComputedStyle(element);

                const hasModernColor = (value: string) => {
                  return (
                    value &&
                    (value.includes("lab(") ||
                      value.includes("oklab(") ||
                      value.includes("lch(") ||
                      value.includes("oklch(") ||
                      value.includes("color("))
                  );
                };

                if (hasModernColor(computedStyle.backgroundColor)) {
                  element.style.backgroundColor = "transparent";
                }
                if (hasModernColor(computedStyle.color)) {
                  element.style.color = "#000000";
                }
                if (hasModernColor(computedStyle.borderColor)) {
                  element.style.borderColor = "transparent";
                }
                if (hasModernColor(computedStyle.boxShadow)) {
                  element.style.boxShadow = "none";
                }
              });
            },
          });

          pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.95),
            "JPEG",
            0,
            0,
            pageWidth,
            pageHeight
          );
        }
      }

      // Generate content pages
      const previewElement = document.getElementById("proposal-pdf-source");
      if (previewElement) {
        const originalStyle = previewElement.style.cssText;
        previewElement.style.width = "210mm";
        previewElement.style.fontFamily = settings.fontFamily;

        // Preload all images in content before rendering
        await preloadImages(previewElement);

        const canvas = await html2canvas(previewElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc) => {
            const allElements = clonedDoc.querySelectorAll("*");
            allElements.forEach((el) => {
              const element = el as HTMLElement;
              const computedStyle = window.getComputedStyle(element);

              const hasModernColor = (value: string) => {
                return (
                  value &&
                  (value.includes("lab(") ||
                    value.includes("oklab(") ||
                    value.includes("lch(") ||
                    value.includes("oklch(") ||
                    value.includes("color("))
                );
              };

              if (hasModernColor(computedStyle.backgroundColor)) {
                element.style.backgroundColor = "#ffffff";
              }
              if (hasModernColor(computedStyle.color)) {
                element.style.color = "#000000";
              }
              if (hasModernColor(computedStyle.borderColor)) {
                element.style.borderColor = "#cccccc";
              }
              if (hasModernColor(computedStyle.boxShadow)) {
                element.style.boxShadow = "none";
              }
            });
          },
        });

        // Restore original styles
        previewElement.style.cssText = originalStyle;

        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Add first content page
        if (includeCover) pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;

        // Add remaining pages if content overflows
        while (heightLeft > 0) {
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

      // Download
      const title = proposal.title || "comercial";
      const filename = `proposta-${title
        .toLowerCase()
        .replace(/\s+/g, "-")}.pdf`;
      pdf.save(filename);
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Verifique o console para mais detalhes.");
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    handleGenerate,
  };
}
