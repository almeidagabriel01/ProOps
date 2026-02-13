import * as React from "react";
import { ProposalProduct } from "@/services/proposal-service";
import { ProposalSistema } from "@/types/automation";
import { ProductRow } from "./product-row";

interface SystemGroupRowsProps {
  selectedSistemas: ProposalSistema[];
  selectedProducts: ProposalProduct[];
  primaryColor: string;
  isProductInactive: (product: ProposalProduct) => boolean;
}

export function SystemGroupRows({
  selectedSistemas,
  selectedProducts,
  primaryColor,
  isProductInactive,
}: SystemGroupRowsProps) {
  return (
    <>
      {selectedSistemas.map((sistema, sistemaIdx) => {
        // Fallback for legacy structure or if key 'ambientes' is missing
        const environments =
          sistema.ambientes && sistema.ambientes.length > 0
            ? sistema.ambientes
            : sistema.ambienteId
              ? [
                  {
                    ambienteId: sistema.ambienteId,
                    ambienteName: sistema.ambienteName || "Ambiente",
                  },
                ]
              : [];

        return (
          <React.Fragment key={`sistema-group-${sistemaIdx}`}>
            {environments.map((ambiente, envIdx) => {
              const systemInstanceId = `${sistema.sistemaId}-${ambiente.ambienteId}`;
              const sistemaProducts = selectedProducts.filter(
                (p) => p.systemInstanceId === systemInstanceId,
              );

              const instanceTotal = sistemaProducts.reduce(
                (sum, p) => sum + p.total,
                0,
              );

              if (sistemaProducts.length === 0) return null;

              return (
                <React.Fragment key={`sistema-${sistemaIdx}-env-${envIdx}`}>
                  <tr
                    className="border-t"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <td colSpan={4} className="p-2 font-semibold text-sm">
                      <div className="flex flex-row items-center gap-3">
                        <span className="font-bold text-base text-gray-700 dark:text-gray-300">
                          {sistema.sistemaName}
                        </span>
                        <span className="font-medium text-xs px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border shadow-xs flex items-center gap-1 text-foreground">
                          📍 {ambiente.ambienteName}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {sistemaProducts.map((product, idx) => (
                    <ProductRow
                      key={`${product.productId}-${idx}`}
                      product={product}
                      isInactive={isProductInactive(product)}
                    />
                  ))}
                  <tr className="bg-muted/30">
                    <td
                      colSpan={3}
                      className="p-2 text-right text-sm pl-6 whitespace-nowrap"
                    >
                      Subtotal ({ambiente.ambienteName}):
                    </td>
                    <td className="p-2 text-right font-medium text-sm whitespace-nowrap text-foreground">
                      R$ {(instanceTotal || 0).toFixed(2)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}
