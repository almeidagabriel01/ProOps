import React from "react";
import { Tenant } from "@/types";
import { Proposal } from "@/services/proposal-service";
import {
  ThemeType,
  adjustColor,
} from "@/components/features/proposal/edit-pdf/pdf-theme-utils";
import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX, PADDING_X } from "@/utils/pdf-layout";

interface PdfCoverPageProps {
  theme: ThemeType;
  primaryColor: string;
  coverImage: string;
  coverImageOpacity: number;
  coverImageFit: "cover" | "contain";
  coverImagePosition: string;
  coverLogo: string;
  tenant: Tenant | null;
  coverTitle: string;
  proposal: Proposal;
  fontFamily: string;
}

export function PdfCoverPage({
  theme,
  primaryColor,
  coverImage,
  coverImageOpacity,
  coverImageFit,
  coverImagePosition,
  coverLogo,
  tenant,
  coverTitle,
  proposal,
  fontFamily,
}: PdfCoverPageProps) {
  const coverStyle: React.CSSProperties = {
    height: `${PAGE_HEIGHT_PX}px`,
    width: `${PAGE_WIDTH_PX}px`,
    padding: `${PADDING_X}px`,
    fontFamily,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#ffffff", // Ensure opaque base
  };

  switch (theme) {
    case "modern":
      return (
        <div
          id="pdf-cover-page"
          className="pdf-page-container shadow-2xl"
          data-page-index="0"
          style={{
            ...coverStyle,
            backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(
              primaryColor,
              -30
            )} 100%)`,
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
          id="pdf-cover-page"
          className="pdf-page-container shadow-2xl"
          data-page-index="0"
          style={{
            ...coverStyle,
            backgroundColor: "#0a0a0a", // Dark base for tech theme
            backgroundImage: `linear-gradient(180deg, #0a0a0a 0%, ${primaryColor}20 100%)`,
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
          id="pdf-cover-page"
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
          id="pdf-cover-page"
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
          id="pdf-cover-page"
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
          id="pdf-cover-page"
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
}
