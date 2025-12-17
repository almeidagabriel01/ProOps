"use client";

import { ProposalSection } from "@/types";
import { Proposal } from "@/services/proposal-service";
import { useTenant } from "@/providers/tenant-provider";
import { PreviewSection } from "./preview-section";

interface ProposalPreviewProps {
  proposal: Partial<Proposal>;
  sections: ProposalSection[];
}

export function ProposalPreview({ proposal, sections }: ProposalPreviewProps) {
  const { tenant } = useTenant();

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="bg-card text-gray-900 rounded-lg shadow-lg overflow-hidden">
      {/* A4-like document wrapper */}
      <div
        className="p-8 min-h-[800px] space-y-6"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between border-b pb-6"
          style={{ borderColor: tenant?.primaryColor || "#333" }}
        >
          <div>
            {tenant?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-12 object-contain"
              />
            ) : (
              <div
                className="text-2xl font-bold"
                style={{ color: tenant?.primaryColor || "#333" }}
              >
                {tenant?.name || "Empresa"}
              </div>
            )}
          </div>
          <div className="text-right text-sm text-gray-600">
            <div className="font-semibold text-lg text-gray-900">
              PROPOSTA COMERCIAL
            </div>
            <div>Data: {formatDate(new Date().toISOString())}</div>
            {proposal.validUntil && (
              <div>Válida até: {formatDate(proposal.validUntil)}</div>
            )}
          </div>
        </div>

        {/* Title */}
        {proposal.title && (
          <div className="text-center py-4">
            <h1
              className="text-2xl font-bold"
              style={{ color: tenant?.primaryColor || "#333" }}
            >
              {proposal.title}
            </h1>
          </div>
        )}

        {/* Client Info */}
        {proposal.clientName && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Cliente
            </div>
            <div className="font-semibold text-lg">{proposal.clientName}</div>
            {proposal.clientEmail && (
              <div className="text-sm text-gray-600">
                {proposal.clientEmail}
              </div>
            )}
            {proposal.clientPhone && (
              <div className="text-sm text-gray-600">
                {proposal.clientPhone}
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section, index) => (
            <PreviewSection
              key={index}
              section={section}
              primaryColor={tenant?.primaryColor}
              proposal={proposal}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t pt-6 mt-8 text-center text-sm text-gray-500">
          <p>Esta proposta é válida por 30 dias a partir da data de emissão.</p>
          <p
            className="mt-2 font-semibold"
            style={{ color: tenant?.primaryColor || "#333" }}
          >
            {tenant?.name || "Empresa"}
          </p>
        </div>
      </div>
    </div>
  );
}
