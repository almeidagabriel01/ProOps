
import { useState, useEffect } from "react";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { ProductService } from "@/services/product-service";

export function useEnrichedProducts(proposal: Proposal, tenantId?: string, options?: { filterInactive?: boolean }) {
  const [enrichedProducts, setEnrichedProducts] = useState<ProposalProduct[]>(
    proposal.products || []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProductImages = async () => {
      if (!tenantId || !proposal.products?.length) {
        setEnrichedProducts(proposal.products || []);
        setIsLoading(false);
        return;
      }

      try {
        // Get all products from the tenant's catalog
        const catalogProducts = await ProductService.getProducts(tenantId);

        // Create a map for quick lookup
        const productMap = new Map(catalogProducts.map((p) => [p.id, p]));

        // Enrich proposal products with images from catalog
        const enriched = (proposal.products || []).map((proposalProduct) => {
          const catalogProduct = productMap.get(proposalProduct.productId);
          
          // If filtering is enabled and product is inactive, skip it
          if (options?.filterInactive && catalogProduct && catalogProduct.status === 'inactive') {
            return null;
          }

          if (catalogProduct) {
            return {
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
          }
          return proposalProduct;
        }).filter(Boolean) as ProposalProduct[]; // Remove nulls (inactive products)

        setEnrichedProducts(enriched);
      } catch (error) {
        console.error("Error loading product images:", error);
        setEnrichedProducts(proposal.products || []);
      } finally {
        setIsLoading(false);
      }
    };

    loadProductImages();
  }, [tenantId, proposal.products, options?.filterInactive]);

  return { products: enrichedProducts, isLoading };
}
