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
                
                const hasModernColor = (value: string) => {
                  return value && (
                    value.includes("lab(") ||
                    value.includes("oklab(") ||
                    value.includes("lch(") ||
                    value.includes("oklch(") ||
                    value.includes("color(")
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
                return value && (
                  value.includes("lab(") ||
                  value.includes("oklab(") ||
                  value.includes("lch(") ||
                  value.includes("oklch(") ||
                  value.includes("color(")
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
