import React from "react";
import { formatCurrency } from "@/utils/format-utils";

interface PdfTotalsProps {
    products: any[];
    discount: number;
    contentStyles: any;
}

/**
 * Renders the totals section in PDF
 */
export function PdfTotals({ products, discount, contentStyles }: PdfTotalsProps) {
    const subtotal = products.reduce((sum, p) => sum + p.total, 0);
    const discountAmt = (subtotal * (discount || 0)) / 100;
    const total = subtotal - discountAmt;

    return (
        <div
            className="mt-4 pt-4 border-t-2 flex justify-end"
            style={contentStyles.headerBorder}
        >
            <div className="w-48 space-y-1 text-right">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount && discount > 0 && (
                    <div className="flex justify-between text-red-600">
                        <span>Desconto:</span>
                        <span>-{formatCurrency(discountAmt)}</span>
                    </div>
                )}
                <div
                    className="flex justify-between text-xl font-bold pt-2 border-t"
                    style={contentStyles.total}
                >
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                </div>
            </div>
        </div>
    );
}
