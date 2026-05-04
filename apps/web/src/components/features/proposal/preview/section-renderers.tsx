"use client";

import * as React from "react";
import { ProposalSection, CustomFieldType } from "@/types";
import {
  Proposal,
  ProposalProduct,
  ProposalSystemInstance,
} from "@/services/proposal-service";
import { CustomFieldService } from "@/services/custom-field-service";
import type { TenantNiche } from "@/types";
import {
  formatProposalProductDisplayQuantity,
  getProposalLineUnitSellingPrice,
  getProposalProductMeasurementLabel,
  isCortinasDimensionProductLine,
} from "@/lib/product-pricing";

// ============================================
// TYPES
// ============================================

export interface TableItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// ============================================
// UTILITIES
// ============================================

export function parseContent(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function getTextStyleObj(
  textStyle: Record<string, string | number> | undefined,
) {
  if (!textStyle) return {};
  return {
    color: textStyle.color ? String(textStyle.color) : undefined,
    fontSize: textStyle.fontSize ? `${textStyle.fontSize}px` : undefined,
    fontWeight: textStyle.fontWeight ? String(textStyle.fontWeight) : undefined,
    fontStyle: textStyle.fontStyle ? String(textStyle.fontStyle) : undefined,
    textAlign:
      (textStyle.textAlign as "left" | "center" | "right" | "justify") ||
      undefined,
    textDecoration: textStyle.textDecoration
      ? String(textStyle.textDecoration)
      : undefined,
  };
}

// ============================================
// PRODUCT TABLE SECTION
// ============================================

interface ProductTableSectionProps {
  section: ProposalSection;
  proposal: Partial<Proposal>;
  primaryColor: string;
  tenantNiche?: TenantNiche | null;
}

export function ProductTableSection({
  section,
  proposal,
  primaryColor,
  tenantNiche,
}: ProductTableSectionProps) {
  const products = proposal?.products || [];
  const sistemas = proposal?.sistemas || [];
  const hasSistemas = sistemas.length > 0;

  if (products.length === 0) {
    return (
      <div className="text-gray-500 italic text-center py-4">
        Nenhum produto selecionado
      </div>
    );
  }

  const pdfSettings = typeof window !== "undefined" // Just to ensure we don't import merge if we can avoid it. Actually, I can just do default fallback.
    ? { showProductQuantities: true, showProductMeasurements: true, showProductPrices: false, ...proposal?.pdfSettings }
    : { showProductQuantities: true, showProductMeasurements: true, showProductPrices: false, ...proposal?.pdfSettings };

  const renderProductTable = (
    items: ProposalProduct[],
    title?: string,
    sistemaInfo?: ProposalSystemInstance,
  ) => {
    const total = items.reduce(
      (sum, item) => sum + (item.total || item.quantity * item.unitPrice),
      0,
    );

    const hasQuantityProducts = items.length > 0;
    const showQuantity = pdfSettings.showProductQuantities !== false && hasQuantityProducts;
    
    const hasDimensionProducts = items.some(item => isCortinasDimensionProductLine(tenantNiche, item));
    const showMeasurements = tenantNiche === "cortinas" && pdfSettings.showProductMeasurements !== false && hasDimensionProducts;

    const showMiddleColumn = showQuantity || showMeasurements;
    const showPriceColumn = pdfSettings.showProductPrices !== false;
    
    let middleColumnLabel = "Qtd";
    if (showQuantity && showMeasurements) middleColumnLabel = "Medida / Qtd.";
    else if (showMeasurements) middleColumnLabel = "Medida";

    return (
      <div className="mb-6">
        {sistemaInfo ? (
          <div
            className="flex items-center gap-3 p-3 rounded-t-lg border-x border-t"
            style={{
              borderColor: primaryColor,
              backgroundColor: `${primaryColor}10`,
            }}
          >
            <div className="font-bold text-lg" style={{ color: primaryColor }}>
              {sistemaInfo.sistemaName}
            </div>
            <span
              className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-transparent"
              style={{
                borderColor: `${primaryColor}40`,
                color: primaryColor,
                border: `1px solid ${primaryColor}40`,
                backgroundColor: `${primaryColor}10`,
              }}
            >
              📍 {sistemaInfo.ambienteName}
            </span>
          </div>
        ) : title ? (
          <div className="flex items-center gap-3 p-3 rounded-t-lg border-x border-t bg-muted/30 border-gray-200">
            <div className="font-bold text-lg text-gray-700">{title}</div>
          </div>
        ) : null}

        <table className="w-full border-collapse">
          <thead>
            <tr
              style={{ backgroundColor: primaryColor }}
              className="text-white"
            >
              <th className="text-left px-3 py-2 font-medium first:rounded-tl-none">
                Item
              </th>
              {showMiddleColumn && (
                <th className="text-center px-3 py-2 font-medium w-28">
                  {middleColumnLabel}
                </th>
              )}
              {showPriceColumn && (
                <th className="text-right px-3 py-2 font-medium w-28">
                  Preço Unit.
                </th>
              )}
              <th className="text-right px-3 py-2 font-medium w-28 last:rounded-tr-none">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const isDimension = isCortinasDimensionProductLine(tenantNiche, item);
              
              return (
                <tr
                  key={item.productId || i}
                  className={i % 2 === 0 ? "bg-muted/30" : "bg-card"}
                >
                  <td className="px-3 py-2 border-b border-gray-200">
                    {item.productName || item.name}
                  </td>
                  {showMiddleColumn && (
                    <td className="px-3 py-2 border-b border-gray-200 text-center text-sm">
                      {isDimension
                        ? (
                            showMeasurements || showQuantity ? (
                              <div className="flex flex-col items-center gap-0.5 leading-tight">
                                {showMeasurements && (
                                  <span>{getProposalProductMeasurementLabel(item)}</span>
                                )}
                                {showQuantity && (
                                  <span className="text-xs text-muted-foreground">
                                    Qtd. {formatProposalProductDisplayQuantity(item)}
                                  </span>
                                )}
                              </div>
                            ) : "-"
                          )
                        : (showQuantity ? item.quantity : "-")}
                    </td>
                  )}
                  {showPriceColumn && (
                    <td className="px-3 py-2 border-b border-gray-200 text-right">
                      R${" "}
                      {isDimension
                        ? getProposalLineUnitSellingPrice(item).toFixed(2)
                        : (
                            item.quantity > 0
                              ? (item.total ||
                                  item.quantity * (item.unitPrice || 0)) /
                                item.quantity
                              : item.unitPrice || 0
                          ).toFixed(2)}
                    </td>
                  )}
                  <td className="px-3 py-2 border-b border-gray-200 text-right font-medium">
                    R$ {(item.total || item.quantity * item.unitPrice).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: `${primaryColor}10` }}>
              <td
                colSpan={1 + (showMiddleColumn ? 1 : 0) + (showPriceColumn ? 1 : 0)}
                className="px-3 py-2 text-right font-semibold"
                style={{ color: primaryColor }}
              >
                Subtotal
              </td>
              <td
                className="px-3 py-2 text-right font-bold text-lg"
                style={{ color: primaryColor }}
              >
                R$ {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  if (hasSistemas) {
    const sistemaProductIds = new Set(
      sistemas.flatMap((s) => s.productIds || []),
    );
    const extraProducts = products.filter(
      (p) => !p.systemInstanceId && !sistemaProductIds.has(p.productId),
    );

    return (
      <div>
        {section.title && (
          <h2
            className="text-xl font-bold mb-4 pb-2 border-b-2"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            {section.title}
          </h2>
        )}

        {sistemas.map((sistema) => {
          const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
          let sistemaProducts = products.filter(
            (p) => p.systemInstanceId === systemInstanceId,
          );

          // Fallback for legacy proposals
          const isLegacy = !products.some((p) => p.systemInstanceId);
          if (sistemaProducts.length === 0 && isLegacy) {
            sistemaProducts = products.filter((p) =>
              sistema.productIds?.includes(p.productId),
            );
          }

          if (sistemaProducts.length === 0) return null;
          return (
            <React.Fragment key={`${sistema.sistemaId}-${sistema.ambienteId}`}>
              {renderProductTable(sistemaProducts, undefined, sistema)}
            </React.Fragment>
          );
        })}

        {extraProducts.length > 0 &&
          renderProductTable(extraProducts, "Produtos Extras")}
      </div>
    );
  }

  return (
    <div>
      {section.title && (
        <h2
          className="text-xl font-bold mb-4 pb-2 border-b-2"
          style={{ borderColor: primaryColor, color: primaryColor }}
        >
          {section.title}
        </h2>
      )}
      {renderProductTable(products)}
    </div>
  );
}

// ============================================
// CUSTOM TABLE SECTION
// ============================================

interface CustomTableSectionProps {
  section: ProposalSection;
  primaryColor: string;
}

export function CustomTableSection({
  section,
  primaryColor,
}: CustomTableSectionProps) {
  const content = parseContent(section.content);
  const tableItems = (content.items as TableItem[]) || [];
  const showTotal = content.showTotal !== false;

  if (tableItems.length === 0) return null;

  const total = tableItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  return (
    <div>
      {section.title && (
        <h3 className="font-semibold text-gray-800 mb-3">{section.title}</h3>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ backgroundColor: primaryColor }} className="text-white">
            <th className="text-left px-3 py-2 font-medium">Item</th>
            <th className="text-center px-3 py-2 font-medium w-20">Qtd</th>
            <th className="text-right px-3 py-2 font-medium w-28">
              Preço Unit.
            </th>
            <th className="text-right px-3 py-2 font-medium w-28">Total</th>
          </tr>
        </thead>
        <tbody>
          {tableItems.map((item, i) => (
            <tr
              key={item.id || i}
              className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
            >
              <td className="px-3 py-2 border-b border-gray-200">
                {item.name}
              </td>
              <td className="px-3 py-2 border-b border-gray-200 text-center">
                {item.quantity}
              </td>
              <td className="px-3 py-2 border-b border-gray-200 text-right">
                R$ {item.unitPrice.toFixed(2)}
              </td>
              <td className="px-3 py-2 border-b border-gray-200 text-right font-medium">
                R$ {(item.quantity * item.unitPrice).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        {showTotal && (
          <tfoot>
            <tr
              style={{ backgroundColor: primaryColor }}
              className="text-white"
            >
              <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                Total
              </td>
              <td className="px-3 py-2 text-right font-bold text-lg">
                R$ {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ============================================
// CUSTOM FIELD BLOCK
// ============================================

interface CustomFieldBlockProps {
  section: ProposalSection;
}

export function CustomFieldBlock({ section }: CustomFieldBlockProps) {
  const [fieldType, setFieldType] = React.useState<CustomFieldType | null>(
    null,
  );
  const content = parseContent(section.content);

  React.useEffect(() => {
    const load = async () => {
      if (typeof content.fieldTypeId === "string") {
        const type = await CustomFieldService.getCustomFieldTypeById(
          content.fieldTypeId,
        );
        setFieldType(type);
      }
    };
    load();
  }, [content.fieldTypeId]);

  if (!fieldType) return null;

  const selectedItemIds = (content.selectedItems as string[]) || [];
  const selectedItems = fieldType.items.filter((i) =>
    selectedItemIds.includes(i.id),
  );
  if (selectedItems.length === 0) return null;

  return (
    <div>
      {section.title && (
        <h3 className="font-semibold text-gray-800 mb-3">{section.title}</h3>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {selectedItems.map((item) => (
          <div key={item.id} className="text-center">
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.label}
                className="w-full h-20 object-cover rounded-lg mb-1"
              />
            )}
            <span className="text-sm font-medium text-gray-700">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// HIERARCHICAL FIELD BLOCK
// ============================================

interface HierarchicalFieldBlockProps {
  section: ProposalSection;
  primaryColor: string;
}

export function HierarchicalFieldBlock({
  section,
  primaryColor,
}: HierarchicalFieldBlockProps) {
  const [envType, setEnvType] = React.useState<CustomFieldType | null>(null);
  const [sysType, setSysType] = React.useState<CustomFieldType | null>(null);
  const content = parseContent(section.content);

  React.useEffect(() => {
    const load = async () => {
      if (typeof content.environmentTypeId === "string") {
        const e = await CustomFieldService.getCustomFieldTypeById(
          content.environmentTypeId,
        );
        setEnvType(e);
      }
      if (typeof content.systemTypeId === "string") {
        const s = await CustomFieldService.getCustomFieldTypeById(
          content.systemTypeId,
        );
        setSysType(s);
      }
    };
    load();
  }, [content.environmentTypeId, content.systemTypeId]);

  if (!envType || !sysType) return null;

  const entries =
    (content.entries as {
      id: string;
      environmentItemId: string;
      systemItems: string[];
    }[]) || [];
  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {section.title && (
        <h3 className="font-semibold text-gray-800 mb-3">{section.title}</h3>
      )}
      {entries.map((entry) => {
        const envItem = envType.items.find(
          (i) => i.id === entry.environmentItemId,
        );
        if (!envItem) return null;

        const systemItems = sysType.items.filter((i) =>
          entry.systemItems.includes(i.id),
        );
        if (systemItems.length === 0) return null;

        return (
          <div
            key={entry.id}
            className="border rounded-lg overflow-hidden"
            style={{ borderColor: primaryColor }}
          >
            <div
              className="flex items-center gap-3 p-3 text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {envItem.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={envItem.image}
                  alt={envItem.label}
                  className="w-10 h-10 rounded object-cover"
                />
              )}
              <span className="font-semibold">{envItem.label}</span>
            </div>
            <div className="p-3 bg-gray-50">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {systemItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-card rounded border"
                  >
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.label}
                        className="w-8 h-8 rounded object-cover"
                      />
                    )}
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
