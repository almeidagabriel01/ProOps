"use client";

import { Proposal } from "@/services/proposal-service";
import { formatCurrency, renderText } from "./cover-themes";
import { Tenant } from "@/types";

interface ProductsSectionProps {
  proposal: Partial<Proposal>;
  primaryColor: string;
}

export function ProductsSection({
  proposal,
  primaryColor,
}: ProductsSectionProps) {
  const products = proposal.products || [];
  const subtotal = products.reduce((sum, p) => sum + p.total, 0);
  const discountAmount = (subtotal * (proposal.discount || 0)) / 100;
  const total = subtotal - discountAmount;

  if (products.length === 0) return null;

  return (
    <div>
      <h2
        className="text-xl font-bold mb-4 pb-2 border-b-2"
        style={{ borderColor: primaryColor, color: primaryColor }}
      >
        Produtos e Serviços
      </h2>
      <div className="space-y-4">
        {products.map((product, i) => (
          <div
            key={product.productId}
            className={`flex gap-4 p-4 rounded-lg ${i % 2 === 0 ? "bg-muted/30" : "bg-card"} border`}
          >
            {product.productImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.productImage}
                alt={product.productName}
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {product.productName}
                  </h4>
                  {product.productDescription && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {product.productDescription}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-gray-500">
                    {product.quantity}x {formatCurrency(product.unitPrice)}
                  </div>
                  <div
                    className="font-bold text-lg"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(product.total)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals Summary */}
      <div
        className="mt-6 border-t-2 pt-4"
        style={{ borderColor: primaryColor }}
      >
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {(proposal.discount || 0) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Desconto ({proposal.discount}%):</span>
                <span className="font-medium">
                  - {formatCurrency(discountAmount)}
                </span>
              </div>
            )}
            <div
              className="flex justify-between text-xl font-bold pt-2 border-t"
              style={{ borderColor: primaryColor }}
            >
              <span style={{ color: primaryColor }}>TOTAL:</span>
              <span style={{ color: primaryColor }}>
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ContentHeaderProps {
  proposal: Partial<Proposal>;
  tenant?: Tenant | null;
  primaryColor: string;
}

export function ContentHeader({
  proposal,
  tenant,
  primaryColor,
}: ContentHeaderProps) {
  return (
    <div
      className="flex items-start justify-between border-b-2 pb-6"
      style={{ borderColor: primaryColor }}
    >
      <div>
        {tenant?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt={tenant?.name}
            className="h-12 object-contain"
          />
        ) : (
          <div className="text-2xl font-bold" style={{ color: primaryColor }}>
            {tenant?.name}
          </div>
        )}
      </div>
      <div className="text-right text-sm text-gray-600">
        <div className="font-semibold text-lg text-gray-900">
          {proposal.title}
        </div>
        <div>{proposal.clientName}</div>
        {proposal.clientEmail && <div>{proposal.clientEmail}</div>}
      </div>
    </div>
  );
}

interface TextSectionProps {
  title: string;
  text?: string;
  primaryColor: string;
}

export function TextSection({ title, text, primaryColor }: TextSectionProps) {
  if (!text) return null;
  return (
    <div>
      <h2
        className="text-xl font-bold mb-4 pb-2 border-b-2"
        style={{ borderColor: primaryColor, color: primaryColor }}
      >
        {title}
      </h2>
      <div className="text-gray-700 leading-relaxed">{renderText(text)}</div>
    </div>
  );
}
