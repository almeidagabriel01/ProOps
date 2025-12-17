import React from "react";
import { formatCurrency } from "@/utils/format-utils";
import { getContrastTextColor } from "@/utils/color-utils";

interface PdfExtraProductsBlockProps {
    products: any[];
    primaryColor: string;
}

/**
 * Renders extra products block (products not tied to systems)
 */
export function PdfExtraProductsBlock({ products, primaryColor }: PdfExtraProductsBlockProps) {
    const extraSubtotal = products.reduce((sum: number, p: any) => sum + p.total, 0);

    return (
        <div className="mt-6 mb-4">
            <div
                className="rounded-xl border-2 overflow-hidden"
                style={{ borderColor: primaryColor }}
            >
                {/* Header */}
                <div
                    className="p-5"
                    style={{
                        background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)`,
                        borderBottom: `2px solid ${primaryColor}30`,
                    }}
                >
                    <div className="flex items-center gap-4">
                        <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span
                                    className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow"
                                    style={{
                                        backgroundColor: primaryColor,
                                        color: getContrastTextColor(primaryColor),
                                    }}
                                >
                                    📍 Avulso
                                </span>
                            </div>
                            <h3 className="text-2xl font-bold" style={{ color: primaryColor }}>
                                Produtos Extras
                            </h3>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                Itens adicionais não vinculados a sistemas específicos
                            </p>
                        </div>
                    </div>
                </div>

                {/* Products */}
                <div className="p-4 space-y-3 bg-white">
                    {products.map((product: any, idx: number) => (
                        <div
                            key={product.productId}
                            className="flex items-center gap-4 p-4 rounded-lg border"
                            style={{
                                backgroundColor: idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                                borderColor: '#e5e7eb',
                            }}
                        >
                            {/* Product Image */}
                            {(product.productImage || (product.productImages && product.productImages.length > 0)) && (
                                <div className="w-16 h-16 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={product.productImages?.[0] || product.productImage}
                                        alt=""
                                        className="w-full h-full object-contain p-1"
                                    />
                                </div>
                            )}

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 truncate">{product.productName}</h4>
                                <p className="text-sm text-gray-500">
                                    {product.quantity} un. × {formatCurrency(product.unitPrice)}
                                </p>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                                <span className="font-bold text-lg text-gray-700">
                                    {formatCurrency(product.total)}
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Subtotal */}
                    <div
                        className="flex justify-between items-center pt-3 mt-2"
                        style={{ borderTop: '2px dashed #d1d5db' }}
                    >
                        <span className="font-semibold text-gray-700">Subtotal Extras:</span>
                        <span className="text-xl font-bold text-gray-700">
                            {formatCurrency(extraSubtotal)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
