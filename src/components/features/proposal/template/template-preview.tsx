"use client";

import { ProposalTemplate } from "@/types";
import { Proposal } from "@/services/proposal-service";
import { useTenant } from "@/providers/tenant-provider";
import {
  formatDate,
  renderText,
  ModernCover,
  ClassicCover,
  TechCover,
  ElegantCover,
  BoldCover,
  MinimalCover,
} from "./cover-themes";
import {
  ProductsSection,
  ContentHeader,
  TextSection,
} from "./content-sections";

interface TemplatePreviewProps {
  proposal: Partial<Proposal>;
  template?: ProposalTemplate | null;
}

export function TemplatePreview({ proposal, template }: TemplatePreviewProps) {
  const { tenant } = useTenant();

  const primaryColor =
    template?.primaryColor || tenant?.primaryColor || "#2563eb";
  const fontFamily = template?.fontFamily || "'Inter', sans-serif";

  const coverProps = { proposal, template, tenant, primaryColor };

  const renderCover = () => {
    switch (template?.theme) {
      case "modern":
        return <ModernCover {...coverProps} />;
      case "classic":
        return <ClassicCover {...coverProps} />;
      case "tech":
        return <TechCover {...coverProps} />;
      case "elegant":
        return <ElegantCover {...coverProps} />;
      case "bold":
        return <BoldCover {...coverProps} />;
      default:
        return <MinimalCover {...coverProps} />;
    }
  };

  return (
    <div className="bg-card text-gray-900 shadow-lg" style={{ fontFamily }}>
      {/* Cover Page */}
      {renderCover()}

      {/* Content Pages */}
      <div className="p-12 space-y-8">
        <ContentHeader
          proposal={proposal}
          tenant={tenant}
          primaryColor={primaryColor}
        />

        {/* Introduction */}
        {template?.introductionText && (
          <div className="leading-relaxed text-gray-700">
            {renderText(template.introductionText)}
          </div>
        )}

        {/* Scope */}
        <TextSection
          title="Escopo do Projeto"
          text={template?.scopeText}
          primaryColor={primaryColor}
        />

        {/* Products Table */}
        <ProductsSection proposal={proposal} primaryColor={primaryColor} />

        {/* Custom Notes */}
        {proposal.customNotes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Observações</h3>
            <p className="text-yellow-900 text-sm">
              {renderText(proposal.customNotes)}
            </p>
          </div>
        )}

        {/* Payment Terms */}
        <TextSection
          title="Condições de Pagamento"
          text={template?.paymentTerms}
          primaryColor={primaryColor}
        />

        {/* Warranty */}
        <TextSection
          title="Garantia"
          text={template?.warrantyText}
          primaryColor={primaryColor}
        />

        {/* Validity */}
        {proposal.validUntil && (
          <div className="bg-gray-100 rounded-lg p-4 text-center">
            <span className="text-gray-600">Esta proposta é válida até </span>
            <span className="font-semibold">
              {formatDate(proposal.validUntil)}
            </span>
          </div>
        )}

        {/* Footer */}
        {template?.footerText && (
          <div
            className="mt-12 pt-8 border-t-2"
            style={{ borderColor: primaryColor }}
          >
            <div className="text-gray-700 leading-relaxed">
              {renderText(template.footerText)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
