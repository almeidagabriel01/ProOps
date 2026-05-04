"use client";

import * as React from "react";
import { ProposalTemplate } from "@/types";
import { Proposal } from "@/services/proposal-service";
import { Tenant } from "@/types";
import { formatDateBR } from "@/utils/date-format";

// ============================================
// UTILITIES
// ============================================

export function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

export function formatDate(dateString?: string) {
  return formatDateBR(dateString, "");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function renderText(text?: string) {
  if (!text) return null;
  return text.split("\n").map((line, i) => (
    <React.Fragment key={i}>
      {line}
      {i < text.split("\n").length - 1 && <br />}
    </React.Fragment>
  ));
}

// ============================================
// COVER PAGE THEMES
// ============================================

interface CoverPageProps {
  proposal: Partial<Proposal>;
  template?: ProposalTemplate | null;
  tenant?: Tenant | null;
  primaryColor: string;
}

export function ModernCover({
  proposal,
  tenant,
  primaryColor,
}: CoverPageProps) {
  return (
    <div
      className="min-h-[297mm] p-12 flex flex-col relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
      }}
    >
      <div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
        style={{ backgroundColor: "white" }}
      />
      <div
        className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full opacity-10"
        style={{ backgroundColor: "white" }}
      />
      <div className="relative z-10 flex-1 flex flex-col justify-between text-white">
        <div>
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-16 object-contain brightness-0 invert"
            />
          ) : (
            <div className="text-2xl font-bold">{tenant?.name}</div>
          )}
        </div>
        <div className="my-auto">
          <div className="text-lg uppercase tracking-[0.2em] opacity-80 mb-4">
            Proposta Comercial
          </div>
          <div className="text-5xl font-bold leading-tight mb-6">
            {proposal.title || "Proposta"}
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
        <div className="flex justify-between items-end opacity-80 text-sm">
          <div>{formatDate(new Date().toISOString())}</div>
          {proposal.validUntil && (
            <div className="text-right">
              Válida até
              <br />
              <span className="font-semibold">
                {formatDate(proposal.validUntil)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ClassicCover({
  proposal,
  tenant,
  primaryColor,
}: CoverPageProps) {
  return (
    <div className="min-h-[297mm] p-12 flex flex-col">
      <div
        className="h-2 w-full mb-8"
        style={{ backgroundColor: primaryColor }}
      />
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        {tenant?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt=""
            className="h-24 object-contain mb-12"
          />
        )}
        <div
          className="border-t-2 border-b-2 py-8 px-12"
          style={{ borderColor: primaryColor }}
        >
          <div className="text-lg uppercase tracking-[0.3em] text-gray-500 mb-4">
            Proposta Comercial
          </div>
          <div className="text-4xl font-serif font-bold text-gray-900">
            {proposal.title}
          </div>
        </div>
        <div className="mt-12">
          <div className="text-lg text-gray-600 mb-2">Apresentada a</div>
          <div className="text-2xl font-semibold text-gray-900">
            {proposal.clientName}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-sm text-gray-500">
        <div>{tenant?.name}</div>
        <div>{formatDate(new Date().toISOString())}</div>
      </div>
    </div>
  );
}

export function TechCover({ proposal, tenant, primaryColor }: CoverPageProps) {
  return (
    <div
      className="min-h-[297mm] flex flex-col h-full relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, #0a0a0a 0%, ${primaryColor}20 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${primaryColor}20 1px, transparent 1px), linear-gradient(90deg, ${primaryColor}20 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{ backgroundColor: primaryColor }}
      />
      <div className="relative z-10 flex-1 flex flex-col p-12 text-white">
        <div className="flex items-center gap-3">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="h-10 object-contain brightness-0 invert"
            />
          ) : (
            <div className="text-xl font-bold">{tenant?.name}</div>
          )}
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
          <div className="text-5xl font-bold mb-4">{proposal.title}</div>
          <div className="text-lg opacity-70">
            Preparada para {proposal.clientName}
          </div>
        </div>
        <div className="flex justify-between text-sm opacity-60">
          <span>{formatDate(new Date().toISOString())}</span>
          {proposal.validUntil && (
            <span>Válida até {formatDate(proposal.validUntil)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ElegantCover({ proposal, tenant }: CoverPageProps) {
  return (
    <div className="min-h-[297mm] flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      <div
        className="absolute inset-8 border-2 rounded-lg"
        style={{ borderColor: "#D4AF37" }}
      />
      <div
        className="absolute inset-10 border rounded-lg"
        style={{ borderColor: "#D4AF3750" }}
      />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-16 text-white">
        {tenant?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt=""
            className="h-16 object-contain brightness-0 invert mb-8"
          />
        )}
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
          {proposal.title}
        </div>
        <div
          className="w-16 h-0.5 mb-6"
          style={{ backgroundColor: "#D4AF37" }}
        />
        <div className="text-lg opacity-80">
          Exclusivamente para
          <br />
          <span className="text-xl font-semibold" style={{ color: "#D4AF37" }}>
            {proposal.clientName}
          </span>
        </div>
      </div>
      <div className="absolute bottom-8 left-0 right-0 text-center text-sm text-gray-400">
        {formatDate(new Date().toISOString())}
      </div>
    </div>
  );
}

export function BoldCover({ proposal, tenant, primaryColor }: CoverPageProps) {
  return (
    <div
      className="min-h-[297mm] flex flex-col h-full relative overflow-hidden"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-black opacity-10" />
      <div
        className="absolute -bottom-20 -left-20 w-60 h-60 bg-black opacity-10"
        style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
      />
      <div className="absolute top-1/4 right-1/4 w-32 h-32 border-4 border-white opacity-20 rotate-45" />
      <div className="relative z-10 flex-1 flex flex-col p-12 text-white">
        <div>
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="h-14 object-contain brightness-0 invert"
            />
          ) : (
            <div className="text-2xl font-black">{tenant?.name}</div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-7xl font-black leading-none mb-4">
            {proposal.title}
          </div>
          <div className="text-xl font-semibold opacity-90 border-l-4 border-white pl-4">
            {proposal.clientName}
          </div>
        </div>
        <div className="text-sm font-semibold opacity-80">
          {formatDate(new Date().toISOString())}
        </div>
      </div>
    </div>
  );
}

export function MinimalCover({
  proposal,
  tenant,
  primaryColor,
}: CoverPageProps) {
  return (
    <div className="min-h-[297mm] p-12 flex flex-col h-full items-center justify-center text-center">
      {tenant?.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.logoUrl} alt="" className="h-20 object-contain mb-8" />
      )}
      <div
        className="text-5xl font-light tracking-tight mb-4"
        style={{ color: primaryColor }}
      >
        Proposta Comercial
      </div>
      <div className="text-2xl text-gray-800 font-semibold mb-8">
        {proposal.title}
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
  );
}
