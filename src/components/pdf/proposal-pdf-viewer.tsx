import * as React from "react";
import { Proposal, ProposalTemplate } from "@/lib/mock-db";
import {
  PdfSection,
  createDefaultSections,
} from "@/components/features/proposal/pdf-section-editor";
import { RenderPagedContent } from "@/components/pdf/render-paged-content";

export type ThemeType =
  | "modern"
  | "classic"
  | "minimal"
  | "tech"
  | "elegant"
  | "bold";

interface ProposalPdfViewerProps {
  proposal: Proposal;
  template?: ProposalTemplate | null;
  tenant: any;
  // Overrides for live preview
  customSettings?: {
    theme?: ThemeType;
    primaryColor?: string;
    fontFamily?: string;
    coverTitle?: string;
    coverImage?: string;
    coverLogo?: string;
    coverImageOpacity?: number;
    coverImageFit?: "cover" | "contain";
    coverImagePosition?: string;
    sections?: PdfSection[];
    repeatHeader?: boolean;
  };
}

export function ProposalPdfViewer({
  proposal,
  template,
  tenant,
  customSettings,
}: ProposalPdfViewerProps) {
  // Merge settings: Custom > Template > Defaults
  const theme =
    customSettings?.theme || (template?.theme as ThemeType) || "modern";
  const primaryColor =
    customSettings?.primaryColor ||
    template?.primaryColor ||
    tenant?.primaryColor ||
    "#2563eb";
  const fontFamily =
    customSettings?.fontFamily || template?.fontFamily || "'Inter', sans-serif";
  const coverTitle = customSettings?.coverTitle || proposal.title || "";

  // Cover Image Logic
  const coverImage =
    customSettings?.coverImage !== undefined
      ? customSettings.coverImage
      : template?.coverImage || "";

  const coverLogo =
    customSettings?.coverLogo !== undefined
      ? customSettings.coverLogo
      : (template as any)?.coverLogo || tenant?.logoUrl || "";

  const templateSettings = (template as any)?.coverImageSettings || {};
  const coverImageOpacity =
    customSettings?.coverImageOpacity ?? templateSettings.opacity ?? 30;
  const coverImageFit =
    customSettings?.coverImageFit ?? templateSettings.fit ?? "cover";
  const coverImagePosition =
    customSettings?.coverImagePosition ?? templateSettings.position ?? "center";

  const repeatHeader =
    customSettings?.repeatHeader ?? template?.repeatHeader ?? false;

  // If custom sections provided (preview mode), use them
  // Otherwise, generate from template (view mode) - simulating what edit page does
  const displaySections =
    customSettings?.sections ||
    (template ? createDefaultSections(template, primaryColor) : []);

  const products = proposal.products || [];

  // Helper: Adjust Color
  const adjustColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return (
      "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    );
  };

  // Helper: Get Content Styles
  const getContentStyles = () => {
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
            backgroundColor: primaryColor,
            color: "#ffffff",
            padding: "48px",
            position: "relative" as const,
            overflow: "hidden" as const,
          },
          headerBorder: { borderColor: "#ffffff" },
          headerTitle: { color: "#ffffff" },
          headerSub: { color: "rgba(255,255,255,0.8)" },
          sectionText: { color: "#ffffff" },
          productTitle: { borderColor: "#ffffff", color: "#ffffff" },
          productCard: {
            backgroundColor: "rgba(255,255,255,0.1)",
            borderColor: "rgba(255,255,255,0.2)",
            color: "#ffffff",
          },
          productCardAlt: {
            backgroundColor: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
            color: "#ffffff",
          },
          productSub: { color: "rgba(255,255,255,0.7)" },
          total: { color: "#ffffff" },
        };
      case "minimal":
      default:
        return base;
    }
  };

  const contentStyles = getContentStyles();

  // Helper: Render Theme Decorations
  const renderThemeDecorations = () => {
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

  // Helper: Render Cover Page
  const renderCoverPage = () => {
    const coverStyle: React.CSSProperties = {
      height: "297mm",
      width: "210mm",
      padding: "48px",
      fontFamily,
      position: "relative",
      overflow: "hidden",
    };

    switch (theme) {
      case "modern":
        return (
          <div
            className="pdf-page-container shadow-2xl"
            data-page-index="0"
            style={{
              ...coverStyle,
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
            }}
          >
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white opacity-20" />
            <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full bg-white opacity-10" />
            {coverImage && (
              <img
                src={coverImage}
                alt=""
                className="absolute inset-0 w-full h-full transition-all duration-300"
                style={{
                  opacity: coverImageOpacity / 100,
                  objectFit: coverImageFit,
                  objectPosition: coverImagePosition,
                }}
              />
            )}
            <div className="relative z-10 flex flex-col h-full text-white">
              <div className="flex justify-between items-start">
                <div className="text-2xl font-bold">{tenant?.name}</div>
                {coverLogo && (
                  <img
                    src={coverLogo}
                    alt="Logo"
                    className="h-16 object-contain"
                  />
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-lg uppercase tracking-[0.2em] opacity-80 mb-4">
                  Proposta Comercial
                </div>
                <div className="text-5xl font-bold leading-tight mb-6">
                  {coverTitle}
                </div>
                <div className="w-24 h-1 bg-white/60 mb-8" />
                <div className="text-xl opacity-90">
                  Preparada para
                  <br />
                  <span className="text-2xl font-semibold">
                    {proposal.clientName}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case "tech":
        return (
          <div
            className="pdf-page-container shadow-2xl"
            data-page-index="0"
            style={{
              ...coverStyle,
              background: `linear-gradient(180deg, #0a0a0a 0%, ${primaryColor}20 100%)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `linear-gradient(${primaryColor}20 1px, transparent 1px), linear-gradient(90deg, ${primaryColor}20 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
              }}
            />
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-30"
              style={{ backgroundColor: primaryColor }}
            />
            {coverImage && (
              <img
                src={coverImage}
                alt=""
                className="absolute inset-0 w-full h-full transition-all duration-300"
                style={{
                  opacity: coverImageOpacity / 100,
                  objectFit: coverImageFit,
                  objectPosition: coverImagePosition,
                }}
              />
            )}
            <div className="relative z-10 flex flex-col h-full text-white">
              <div className="flex items-center gap-3">
                {coverLogo && (
                  <img
                    src={coverLogo}
                    alt="Logo"
                    className="h-10 object-contain"
                  />
                )}
                <span className="text-xl font-bold">{tenant?.name}</span>
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div
                  className="text-sm uppercase tracking-[0.3em] opacity-60 mb-4"
                  style={{ color: primaryColor }}
                >
                  Proposta Comercial
                </div>
                <div className="text-5xl font-bold mb-4">{coverTitle}</div>
                <div className="text-lg opacity-70">
                  Preparada para {proposal.clientName}
                </div>
              </div>
            </div>
          </div>
        );
      case "elegant":
        return (
          <div
            className="pdf-page-container shadow-2xl"
            data-page-index="0"
            style={{
              ...coverStyle,
              background:
                "linear-gradient(to bottom right, #111827, #374151, #111827)",
            }}
          >
            <div
              className="absolute inset-8 border-2 rounded-lg"
              style={{ borderColor: "#D4AF37" }}
            />
            {coverImage && (
              <img
                src={coverImage}
                alt=""
                className="absolute inset-0 w-full h-full transition-all duration-300"
                style={{
                  opacity: coverImageOpacity / 100,
                  objectFit: coverImageFit,
                  objectPosition: coverImagePosition,
                }}
              />
            )}
            <div className="relative z-10 flex flex-col h-full items-center justify-center text-center text-white">
              {coverLogo && (
                <img
                  src={coverLogo}
                  alt="Logo"
                  className="h-24 object-contain mb-8"
                />
              )}
              <div className="text-xl font-serif mb-4 tracking-widest uppercase text-white/80">
                {tenant?.name}
              </div>
              <div
                className="w-24 h-0.5 mb-6"
                style={{ backgroundColor: "#D4AF37" }}
              />
              <div
                className="text-sm uppercase tracking-[0.4em] mb-4"
                style={{ color: "#D4AF37" }}
              >
                Proposta Comercial
              </div>
              <div
                className="text-4xl font-serif font-bold mb-6"
                style={{ color: "#D4AF37" }}
              >
                {coverTitle}
              </div>
              <div
                className="w-16 h-0.5 mb-6"
                style={{ backgroundColor: "#D4AF37" }}
              />
              <div className="text-lg opacity-80">
                Exclusivamente para
                <br />
                <span
                  className="text-xl font-semibold"
                  style={{ color: "#D4AF37" }}
                >
                  {proposal.clientName}
                </span>
              </div>
            </div>
          </div>
        );
      case "bold":
        return (
          <div
            className="pdf-page-container shadow-2xl"
            data-page-index="0"
            style={{
              ...coverStyle,
              backgroundColor: primaryColor,
              color: "#ffffff",
            }}
          >
            <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-black opacity-10" />
            <div className="absolute top-1/4 right-1/4 w-32 h-32 border-4 border-white opacity-20 rotate-45" />
            {coverImage && (
              <img
                src={coverImage}
                alt=""
                className="absolute inset-0 w-full h-full transition-all duration-300"
                style={{
                  opacity: coverImageOpacity / 100,
                  objectFit: coverImageFit,
                  objectPosition: coverImagePosition,
                }}
              />
            )}
            <div className="relative z-10 flex flex-col h-full text-white">
              <div className="flex justify-between items-start">
                <div className="text-2xl font-black">{tenant?.name}</div>
                {coverLogo && (
                  <img
                    src={coverLogo}
                    alt="Logo"
                    className="h-14 object-contain"
                  />
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-7xl font-black leading-none mb-4">
                  {coverTitle}
                </div>
                <div className="text-xl font-semibold opacity-90 border-l-4 border-white pl-4">
                  {proposal.clientName}
                </div>
              </div>
            </div>
          </div>
        );
      case "classic":
        return (
          <div
            className="pdf-page-container shadow-2xl"
            data-page-index="0"
            style={{
              ...coverStyle,
              backgroundColor: "#ffffff",
              padding: "40px", // Extra padding for border
            }}
          >
            {/* Classic Border Frame */}
            <div
              className="absolute inset-6 border-4 border-double pointer-events-none"
              style={{ borderColor: primaryColor, opacity: 0.3 }}
            />

            {coverImage && (
              <img
                src={coverImage}
                alt=""
                className="absolute inset-0 w-full h-full transition-all duration-300"
                style={{
                  opacity: (coverImageOpacity * 0.5) / 100, // Reduced opacity for classic
                  objectFit: coverImageFit,
                  objectPosition: coverImagePosition,
                  zIndex: 0,
                }}
              />
            )}

            <div className="relative z-10 flex flex-col h-full items-center justify-center text-center">
              {coverLogo && (
                <img
                  src={coverLogo}
                  alt="Logo"
                  className="h-28 object-contain mb-10"
                />
              )}

              <div
                className="w-full border-t border-b py-8 mb-8"
                style={{ borderColor: primaryColor }}
              >
                <div className="text-lg font-serif tracking-[0.25em] uppercase text-gray-600 mb-2">
                  Proposta Comercial
                </div>
                <div className="text-5xl font-serif font-bold text-gray-900">
                  {coverTitle}
                </div>
              </div>

              <div className="mt-8 font-serif">
                <div className="text-xl text-gray-500 italic mb-3">
                  Apresentado para
                </div>
                <div className="text-3xl font-bold text-gray-800">
                  {proposal.clientName}
                </div>
              </div>
            </div>
          </div>
        );
      case "minimal":
      default:
        // Minimal / Classic (white background)
        return (
          <div
            className="pdf-page-container shadow-2xl"
            data-page-index="0"
            style={{ ...coverStyle, backgroundColor: "#ffffff" }}
          >
            {coverImage && (
              <img
                src={coverImage}
                alt=""
                className="absolute inset-0 w-full h-full transition-all duration-300"
                style={{
                  opacity: coverImageOpacity / 100,
                  objectFit: coverImageFit,
                  objectPosition: coverImagePosition,
                }}
              />
            )}
            <div className="relative z-10 flex flex-col h-full items-center justify-center text-center">
              {coverLogo && (
                <img
                  src={coverLogo}
                  alt="Logo"
                  className="h-24 object-contain mb-8"
                />
              )}
              <div
                className="text-5xl font-light tracking-tight mb-4"
                style={{ color: primaryColor }}
              >
                Proposta Comercial
              </div>
              <div className="text-2xl text-gray-800 font-semibold mb-8">
                {coverTitle}
              </div>
              <div
                className="w-24 h-1 mx-auto mb-8"
                style={{ backgroundColor: primaryColor }}
              />
              <div className="text-lg text-gray-600">
                Para:{" "}
                <span className="font-semibold text-gray-800">
                  {proposal.clientName}
                </span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {renderCoverPage()}
      <RenderPagedContent
        sections={displaySections}
        products={products}
        fontFamily={fontFamily}
        contentStyles={contentStyles}
        primaryColor={primaryColor}
        renderThemeDecorations={renderThemeDecorations}
        tenant={tenant}
        coverTitle={coverTitle}
        proposal={proposal}
        repeatHeader={repeatHeader}
      />
    </>
  );
}
