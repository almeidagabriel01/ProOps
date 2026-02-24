
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
    const normalizeProposalProduct = (
      proposalProduct: ProposalProduct,
    ): ProposalProduct => {
      const normalizedQuantity = Number(proposalProduct.quantity || 0);
      const normalizedImages = Array.isArray(proposalProduct.productImages)
        ? proposalProduct.productImages.filter((img) => typeof img === "string" && img)
        : [];
      const fallbackImage = proposalProduct.productImage || normalizedImages[0] || "";
      const isGhost = normalizedQuantity <= 0;
      const isInactive = options?.filterInactive && proposalProduct.status === "inactive";

      return {
        ...proposalProduct,
        quantity: normalizedQuantity,
        productImage: fallbackImage,
        productImages:
          normalizedImages.length > 0
            ? normalizedImages
            : fallbackImage
              ? [fallbackImage]
              : [],
        _isInactive: isInactive,
        _isGhost: isGhost,
        _shouldHide: Boolean(proposalProduct._shouldHide || isGhost || isInactive),
      };
    };

    const loadProductImages = async () => {
      if (
        options?.skipCatalogEnrichment ||
        !tenantId ||
        !proposal?.products?.length
      ) {
        // Enforce a small delay to allow DOM to settle and React to finish measuring
        // layout in RenderPagedContent before declaring products ready for PDF generation.
        setTimeout(() => {
          setEnrichedProducts(
            (proposal?.products || []).map((p) => normalizeProposalProduct(p)),
          );
          setIsLoading(false);
        }, 150);
        return;
      }

      try {
        // Get all products from the tenant's catalog
        const catalogProducts = await ProductService.getProducts(tenantId);

        // Create a map for quick lookup
        const productMap = new Map(catalogProducts.map((p) => [p.id, p]));

        // Enrich proposal products with images from catalog
        const enriched = (proposal?.products || []).map((proposalProduct) => {
          const baseProduct = normalizeProposalProduct(proposalProduct);
          const catalogProduct = productMap.get(proposalProduct.productId);
          
          if (catalogProduct) {
            const baseEnriched = {
              ...baseProduct,
              productImage:
                catalogProduct.images?.[0] || catalogProduct.image || baseProduct.productImage || "",
              productImages: catalogProduct.images?.length
                ? catalogProduct.images
                : catalogProduct.image
                  ? [catalogProduct.image]
                  : baseProduct.productImages || [],
              productDescription:
                catalogProduct.description ||
                proposalProduct.productDescription ||
                "",
            };

            // Metadata flags
            const isInactiveStatus = options?.filterInactive && (catalogProduct.status === 'inactive' || proposalProduct.status === 'inactive');
            const isGhost = (baseProduct.quantity || 0) <= 0;

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
          const isInactiveStatus =
            options?.filterInactive && proposalProduct.status === "inactive";

          if (isInactiveStatus || baseProduct._isGhost) {
            return {
              ...baseProduct,
              _isInactive: Boolean(isInactiveStatus),
              _isGhost: Boolean(baseProduct._isGhost),
              _shouldHide: true,
            };
          }

          return baseProduct;
        }); // Keep all products, including inactive ones

        setEnrichedProducts(enriched);
      } catch (error) {
        console.error("Error loading product images:", error);
        setEnrichedProducts(
          (proposal?.products || []).map((p) => normalizeProposalProduct(p)),
        );
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
