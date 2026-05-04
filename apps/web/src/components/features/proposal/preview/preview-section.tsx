"use client";

import { ProposalSection } from "@/types";
import type { TenantNiche } from "@/types";
import { Proposal } from "@/services/proposal-service";
import {
  parseContent,
  getTextStyleObj,
  ProductTableSection,
  CustomTableSection,
  CustomFieldBlock,
  HierarchicalFieldBlock,
} from "./section-renderers";

interface PreviewSectionProps {
  section: ProposalSection;
  primaryColor?: string;
  proposal: Partial<Proposal>;
  tenantNiche?: TenantNiche | null;
}

export function PreviewSection({
  section,
  primaryColor,
  proposal,
  tenantNiche,
}: PreviewSectionProps) {
  const content = parseContent(section.content);
  const color = primaryColor || "#333";
  const textStyle = section.textStyle || {};
  const imageStyle = section.imageStyle || {};

  switch (section.type) {
    case "product-table":
      return (
        <ProductTableSection
          section={section}
          proposal={proposal}
          primaryColor={color}
          tenantNiche={tenantNiche}
        />
      );

    case "header":
      return (
        <div>
          <h2
            className="text-xl font-bold pb-2 border-b-2"
            style={{
              borderColor: textStyle.color || color,
              ...getTextStyleObj(textStyle),
              color: textStyle.color || color,
            }}
          >
            {(content.text as string) || section.title}
          </h2>
        </div>
      );

    case "text":
      return (
        <div>
          {section.title && (
            <h3 className="font-semibold text-gray-800 mb-2">
              {section.title}
            </h3>
          )}
          <p
            className="text-gray-700 whitespace-pre-wrap leading-relaxed"
            style={getTextStyleObj(textStyle)}
          >
            {(content.text as string) || ""}
          </p>
        </div>
      );

    case "image": {
      const imageData = (content.data as string) || (content.url as string);
      const caption = content.caption as string | undefined;
      if (!imageData) return null;

      const alignClass = {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      }[imageStyle.align || "center"];

      return (
        <div className={alignClass}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageData}
            alt={caption || "Imagem"}
            className="inline-block"
            style={{
              width: imageStyle.width ? `${imageStyle.width}%` : "auto",
              maxWidth: "100%",
              borderRadius: imageStyle.borderRadius || 0,
              boxShadow: imageStyle.shadow
                ? "0 4px 12px rgba(0,0,0,0.15)"
                : undefined,
            }}
          />
          {caption && (
            <p className="text-sm text-gray-500 mt-2 italic">{caption}</p>
          )}
        </div>
      );
    }

    case "list": {
      const items = (content.items as string[]) || [];
      if (items.length === 0) return null;
      return (
        <div>
          {section.title && (
            <h3 className="font-semibold text-gray-800 mb-2">
              {section.title}
            </h3>
          )}
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {items.map((item, i) => item && <li key={i}>{item}</li>)}
          </ul>
        </div>
      );
    }

    case "table":
      return <CustomTableSection section={section} primaryColor={color} />;

    case "separator":
      return <hr className="border-gray-300 my-4" />;

    case "custom-field":
      return <CustomFieldBlock section={section} />;

    case "hierarchical-field":
      return <HierarchicalFieldBlock section={section} primaryColor={color} />;

    default:
      return null;
  }
}
