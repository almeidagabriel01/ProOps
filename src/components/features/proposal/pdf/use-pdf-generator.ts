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
                if (computedStyle.backgroundColor.includes("lab")) {
                  element.style.backgroundColor = "transparent";
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
      const previewElement = document.getElementById("proposal-preview");
      if (previewElement) {
        const originalStyle = previewElement.style.cssText;
        previewElement.style.width = "210mm";
        previewElement.style.fontFamily = settings.fontFamily;

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
              // Fix modern color formats that html2canvas doesn't support well
              if (
                computedStyle.backgroundColor.includes("lab") ||
                computedStyle.backgroundColor.includes("oklab") ||
                computedStyle.backgroundColor.includes("lch")
              ) {
                element.style.backgroundColor = "#ffffff";
              }
              if (
                computedStyle.color.includes("lab") ||
                computedStyle.color.includes("oklab") ||
                computedStyle.color.includes("lch")
              ) {
                element.style.color = "#000000";
              }
              if (
                computedStyle.borderColor.includes("lab") ||
                computedStyle.borderColor.includes("oklab") ||
                computedStyle.borderColor.includes("lch")
              ) {
                element.style.borderColor = "#cccccc";
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
