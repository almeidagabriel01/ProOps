import { Badge } from "@/components/ui/badge";
import { ProposalProduct } from "@/services/proposal-service";

interface ProductRowProps {
  product: ProposalProduct;
  isInactive: boolean;
}

export function ProductRow({ product, isInactive }: ProductRowProps) {
  return (
    <tr className="border-t">
      <td className="p-3 font-medium pl-6">
        <div className="flex items-center gap-2">
          <span>{product.productName}</span>
          {(product.itemType || "product") === "service" && (
            <Badge
              variant="default"
              className="text-[10px] h-5 px-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
            >
              Serviço
            </Badge>
          )}
          {product.isExtra && (
            <Badge
              variant="default"
              className="text-[10px] h-5 px-1 bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
            >
              Extra
            </Badge>
          )}
          {/* Note: Logic for 'extra' label in non-system group differs slightly in original code (text-xs span), 
              standardizing to use Badge here if applicable, or keeping original structure if distinct.
              Will stick to general layout. 
          */}
          {isInactive && (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1 bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-300"
            >
              Inativo
            </Badge>
          )}
        </div>
      </td>
      <td className="p-3 text-center">{product.quantity}</td>
      <td className="p-3 text-right whitespace-nowrap">
        R${" "}
        {((product.unitPrice || 0) * (1 + (product.markup || 0) / 100)).toFixed(
          2,
        )}
      </td>
      <td className="p-3 text-right font-medium whitespace-nowrap">
        R$ {(product.total || 0).toFixed(2)}
      </td>
    </tr>
  );
}
