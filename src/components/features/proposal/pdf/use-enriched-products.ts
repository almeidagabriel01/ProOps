import { useState, useEffect } from "react";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { ProductService } from "@/services/product-service";

function hasProposalProductVisualSnapshot(product: ProposalProduct): boolean {
  if (product.itemType === "service") return true;

  const hasImage =
    Boolean(product.productImage) ||
    (Array.isArray(product.productImages) &&
      product.productImages.some(Boolean));
  const hasName = Boolean(product.productName);
  return hasImage && hasName;
}

export function useEnrichedProducts(
  proposal: Proposal | null | undefined,
  tenantId?: string,
  options?: { filterInactive?: boolean; skipCatalogEnrichment?: boolean },
) {
  const shouldStartLoading = Boolean(
    proposal?.products?.length &&
      !options?.skipCatalogEnrichment &&
      tenantId &&
      proposal.products.some(
        (product) =>
          product.itemType !== "service" &&
          typeof product.productId === "string" &&
          !!product.productId &&
          !hasProposalProductVisualSnapshot(product),
      ),
  );

  const [enrichedProducts, setEnrichedProducts] = useState<ProposalProduct[]>(
    proposal?.products || [],
  );
  const [isLoading, setIsLoading] = useState(shouldStartLoading);

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
      const isInactive =
        options?.filterInactive && proposalProduct.status === "inactive";

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

    let isCancelled = false;

    const loadProductImages = async () => {
      const proposalProducts = proposal?.products || [];
      const normalizedProducts = proposalProducts.map((p) =>
        normalizeProposalProduct(p),
      );

      if (
        options?.skipCatalogEnrichment ||
        !tenantId ||
        proposalProducts.length === 0
      ) {
        if (!isCancelled) {
          setEnrichedProducts(normalizedProducts);
          setIsLoading(false);
        }
        return;
      }

      const productIdsToFetch = Array.from(
        new Set(
          proposalProducts
            .filter((proposalProduct) => !hasProposalProductVisualSnapshot(proposalProduct))
            .filter((proposalProduct) => proposalProduct.itemType !== "service")
            .map((proposalProduct) => proposalProduct.productId)
            .filter((id): id is string => typeof id === "string" && !!id),
        ),
      );

      if (productIdsToFetch.length === 0) {
        if (!isCancelled) {
          setEnrichedProducts(normalizedProducts);
          setIsLoading(false);
        }
        return;
      }

      if (!isCancelled) {
        setIsLoading(true);
      }

      try {
        const catalogProducts = await ProductService.getProductsByIds(
          tenantId,
          productIdsToFetch,
        );

        const productMap = new Map(catalogProducts.map((p) => [p.id, p]));

        const enriched = proposalProducts.map((proposalProduct) => {
          const baseProduct = normalizeProposalProduct(proposalProduct);
          const catalogProduct = productMap.get(proposalProduct.productId);

          if (catalogProduct) {
            const baseEnriched = {
              ...baseProduct,
              productImage:
                catalogProduct.images?.[0] ||
                catalogProduct.image ||
                baseProduct.productImage ||
                "",
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
            const isInactiveStatus =
              options?.filterInactive && proposalProduct.status === "inactive";
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

        if (!isCancelled) {
          setEnrichedProducts(enriched);
        }
      } catch (error) {
        console.error("Error loading product images:", error);
        if (!isCancelled) {
          setEnrichedProducts(normalizedProducts);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadProductImages();
    return () => {
      isCancelled = true;
    };
  }, [
    tenantId,
    proposal?.products,
    options?.filterInactive,
    options?.skipCatalogEnrichment,
  ]);

  return { products: enrichedProducts, isLoading };
}
