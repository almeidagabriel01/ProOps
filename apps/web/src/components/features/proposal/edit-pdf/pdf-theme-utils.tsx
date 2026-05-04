import React from "react";
import { pdfFontOptionsWithId } from "@/services/pdf/pdf-fonts";

export const fontOptions = pdfFontOptionsWithId;

export const themeOptions = [
  {
    value: "modern",
    label: "Moderno",
    description: "Gradientes vibrantes",
    preview: "bg-gradient-to-br from-blue-600 to-blue-800",
    defaultColor: "#2563eb",
  },
  {
    value: "classic",
    label: "Clássico",
    description: "Elegante e formal",
    preview: "bg-white border-2",
    defaultColor: "#334155",
  },
  {
    value: "minimal",
    label: "Minimalista",
    description: "Limpo e direto",
    preview: "bg-gray-50",
    defaultColor: "#0f172a",
  },
  {
    value: "tech",
    label: "Tech",
    description: "Futurista e dark",
    preview: "bg-gradient-to-b from-gray-900 to-gray-800",
    defaultColor: "#06b6d4",
  },
  {
    value: "elegant",
    label: "Elegante",
    description: "Premium dourado",
    preview: "bg-gradient-to-br from-gray-900 to-gray-700",
    defaultColor: "#D4AF37",
  },
  {
    value: "bold",
    label: "Impactante",
    description: "Cores vibrantes",
    preview: "bg-gradient-to-br from-purple-600 to-pink-600",
    defaultColor: "#9333ea",
  },
  {
    value: "livre",
    label: "Livre",
    description: "100% personalizável",
    preview: "bg-gradient-to-br from-emerald-500 to-teal-600",
    defaultColor: "#10b981",
    isEnterprise: true,
  },
];

export type ThemeType =
  | "modern"
  | "classic"
  | "minimal"
  | "tech"
  | "elegant"
  | "bold"
  | "livre";

export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

export const adjustColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
};

export const getContentStyles = (theme: ThemeType, primaryColor: string) => {
  const base = {
    container: {
      backgroundColor: "#ffffff",
      color: "#1f2937",
      padding: "48px",
      position: "relative" as const,
      overflow: "hidden" as const,
    },
    headerBorder: { borderColor: primaryColor },
    headerTitle: { color: primaryColor },
    headerSub: { color: "#4b5563" },
    sectionText: { color: "#374151" },
    productTitle: { borderColor: primaryColor, color: primaryColor },
    productCard: {
      backgroundColor: "#ffffff",
      borderColor: "#e5e7eb",
      color: "#1f2937",
    },
    productCardAlt: {
      backgroundColor: "#f9fafb",
      borderColor: "#e5e7eb",
      color: "#1f2937",
    },
    productSub: { color: "#6b7280" },
    subtotal: { color: "#374151" },
    discount: { color: "#dc2626" },
    total: { color: primaryColor },
  };

  switch (theme) {
    case "tech":
      return {
        ...base,
        headerSub: { color: "#6b7280" },
        productCard: {
          backgroundColor: "#ffffff",
          borderColor: primaryColor,
          color: "#1f2937",
        },
        productCardAlt: {
          backgroundColor: "#f3f4f6",
          borderColor: primaryColor,
          color: "#1f2937",
        },
      };
    case "elegant":
      return {
        ...base,
        headerBorder: { borderColor: primaryColor },
        headerTitle: { color: primaryColor },
        productTitle: { borderColor: primaryColor, color: primaryColor },
        total: { color: primaryColor },
        productCard: {
          backgroundColor: "#ffffff",
          borderColor: primaryColor,
          color: "#1f2937",
        },
        productCardAlt: {
          backgroundColor: "#fafaf9",
          borderColor: primaryColor,
          color: "#1f2937",
        },
      };
    case "bold":
      return {
        ...base,
        container: {
          backgroundColor: "#ffffff",
          color: "#1f2937",
          padding: "48px",
          position: "relative" as const,
          overflow: "hidden" as const,
        },
        headerBorder: { borderColor: primaryColor },
        headerTitle: { color: primaryColor },
        headerSub: { color: "#4b5563" },
        sectionText: { color: "#374151" },
        productTitle: { borderColor: primaryColor, color: primaryColor },
        productCard: {
          backgroundColor: `${primaryColor}08`,
          borderColor: `${primaryColor}30`,
          color: "#1f2937",
        },
        productCardAlt: {
          backgroundColor: `${primaryColor}05`,
          borderColor: `${primaryColor}20`,
          color: "#1f2937",
        },
        productSub: { color: "#6b7280" },
        subtotal: { color: "#374151" },
        discount: { color: "#dc2626" },
        total: { color: primaryColor },
      };
    case "minimal":
      return base;
    default:
      return base;
  }
};

export const PdfThemeDecorations: React.FC<{
  theme: ThemeType;
  primaryColor: string;
}> = ({ theme, primaryColor }) => {
  switch (theme) {
    case "modern":
      return (
        <>
          <div
            className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100/50 to-transparent rounded-bl-full pointer-events-none"
            style={
              {
                "--tw-gradient-from": `${primaryColor}20`,
              } as React.CSSProperties
            }
          />
          <div
            className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-100/50 to-transparent rounded-tr-full pointer-events-none"
            style={
              {
                "--tw-gradient-from": `${primaryColor}20`,
              } as React.CSSProperties
            }
          />
        </>
      );
    case "tech":
      return (
        <>
          <div
            className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"
            style={
              {
                "--tw-gradient-via": `${primaryColor}80`,
              } as React.CSSProperties
            }
          />
          <div
            className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 pointer-events-none"
            style={{ borderColor: primaryColor }}
          />
          <div
            className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 pointer-events-none"
            style={{ borderColor: primaryColor }}
          />
          <div
            className="absolute top-12 right-4 w-2 h-2 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
          <div
            className="absolute bottom-12 left-4 w-2 h-2 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
        </>
      );
    case "elegant":
      return (
        <>
          <div
            className="absolute inset-6 border pointer-events-none"
            style={{ borderColor: primaryColor, opacity: 0.3 }}
          />
          <div
            className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 pointer-events-none"
            style={{ borderColor: primaryColor }}
          />
          <div
            className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 pointer-events-none"
            style={{ borderColor: primaryColor }}
          />
          <div
            className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 pointer-events-none"
            style={{ borderColor: primaryColor }}
          />
          <div
            className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 pointer-events-none"
            style={{ borderColor: primaryColor }}
          />
        </>
      );
    case "bold":
      return (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-4"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          />
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-bl-full -z-10 opacity-10" />
        </>
      );
    case "classic":
      return (
        <div
          className="absolute inset-8 border pointer-events-none"
          style={{
            borderColor: primaryColor,
            opacity: 0.1,
            borderWidth: "1px",
          }}
        />
      );
    default:
      return null;
  }
};

