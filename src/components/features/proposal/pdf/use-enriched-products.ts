
import { useState, useEffect } from "react";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { ProductService } from "@/services/product-service";

export function useEnrichedProducts(
  proposal: Proposal | null | undefined,
  tenantId?: string,
  options?: { filterInactive?: boolean; skipCatalogEnrichment?: boolean },
) {
  const [enrichedProducts, setEnrichedProducts] = useState<ProposalProduct[]>(
    proposal?.products || []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProductImages = async () => {
      if (
        options?.skipCatalogEnrichment ||
        !tenantId ||
        !proposal?.products?.length
      ) {
        setEnrichedProducts(proposal?.products || []);
        setIsLoading(false);
        return;
      }

      try {
        // Get all products from the tenant's catalog
        const catalogProducts = await ProductService.getProducts(tenantId);

        // Create a map for quick lookup
        const productMap = new Map(catalogProducts.map((p) => [p.id, p]));

        // Enrich proposal products with images from catalog
        const enriched = (proposal?.products || []).map((proposalProduct) => {
          const catalogProduct = productMap.get(proposalProduct.productId);
          
          if (catalogProduct) {
            const baseEnriched = {
              ...proposalProduct,
              productImage:
                catalogProduct.images?.[0] || catalogProduct.image || "",
              productImages: catalogProduct.images?.length
                ? catalogProduct.images
                : catalogProduct.image
                  ? [catalogProduct.image]
                  : [],
              productDescription:
                catalogProduct.description ||
                proposalProduct.productDescription ||
                "",
            };

            // Metadata flags
            const isInactiveStatus = options?.filterInactive && (catalogProduct.status === 'inactive' || proposalProduct.status === 'inactive');
            const isGhost = (proposalProduct.quantity || 0) === 0;

            if (isInactiveStatus || isGhost) {
              return {
                ...baseEnriched,
                _isInactive: isInactiveStatus, // Metadata flag for visual hiding in list (status based)
                _isGhost: isGhost, // Metadata flag for 0 quantity (hidden + excluded from total)
                _shouldHide: true, // Helper for list filtering
              };
            }

            return baseEnriched;
          }
          return proposalProduct;
        }); // Keep all products, including inactive ones

        setEnrichedProducts(enriched);
      } catch (error) {
        console.error("Error loading product images:", error);
        setEnrichedProducts(proposal?.products || []);
      } finally {
        setIsLoading(false);
      }
    };

    loadProductImages();
  }, [
    tenantId,
    proposal?.products,
    options?.filterInactive,
    options?.skipCatalogEnrichment,
  ]);

  return { products: enrichedProducts, isLoading };
}
