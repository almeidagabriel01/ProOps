import { ProposalProduct } from "@/types/proposal";
import { formatCurrency } from "@/utils/format-utils";

interface PdfTotalsProps {
    products: ProposalProduct[];
    discount: number;
    contentStyles: Record<string, React.CSSProperties>;
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
            className="mt-6 pt-5 border-t-2 flex justify-end"
            style={contentStyles.headerBorder}
        >
            <div className="w-56 grid gap-2 text-right">
                <div className="flex items-baseline justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {discount && discount > 0 && (
                    <div className="flex items-baseline justify-between text-red-600">
                        <span>Desconto:</span>
                        <span>-{formatCurrency(discountAmt)}</span>
                    </div>
                )}
                <div
                    className="flex items-baseline justify-between text-xl font-bold pt-3 border-t"
                    style={contentStyles.total}
                >
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                </div>
            </div>
        </div>
    );
}
