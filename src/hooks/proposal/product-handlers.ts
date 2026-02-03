import * as React from "react";
import { Product } from "@/services/product-service";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { ProposalSistema } from "@/types/automation";

interface ProductHandlersProps {
  selectedProducts: ProposalProduct[];
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
}

// Toggle product selection
export function createToggleProduct({
  selectedProducts,
  setFormData,
}: ProductHandlersProps) {
  return (product: Product) => {
    const existing = selectedProducts.find((p) => p.productId === product.id);
    if (existing) {
      setFormData((prev) => ({
        ...prev,
        products: selectedProducts.filter((p) => p.productId !== product.id),
      }));
    } else {
      const price = parseFloat(product.price) || 0;
      const markup = parseFloat(product.markup || "0");
      const newProduct: ProposalProduct = {
        productId: product.id,
        productName: product.name,
        productImage: product.images?.[0] || product.image || "",
        productImages: product.images?.length
          ? product.images
          : product.image
            ? [product.image]
            : [],
        productDescription: product.description || "",
        quantity: 1,
        unitPrice: price,
        markup: markup,
        total: price * (1 + markup / 100),
        manufacturer: product.manufacturer,
        category: product.category,
      };
      setFormData((prev) => ({
        ...prev,
        products: [...selectedProducts, newProduct],
      }));
    }
  };
}

// Update product quantity
export function createUpdateProductQuantity({
  selectedProducts,
  setFormData,
}: ProductHandlersProps) {
  return (productId: string, delta: number, systemInstanceId?: string) => {
    setFormData((prev) => ({
      ...prev,
      products: selectedProducts.map((p) => {
        if (
          systemInstanceId &&
          p.systemInstanceId === systemInstanceId &&
          p.productId === productId
        ) {
          const newQty = Math.max(1, p.quantity + delta);
          const sellingPrice = p.unitPrice * (1 + (p.markup || 0) / 100);
          return { ...p, quantity: newQty, total: newQty * sellingPrice };
        } else if (
          !systemInstanceId &&
          !p.systemInstanceId &&
          p.productId === productId
        ) {
          const newQty = Math.max(1, p.quantity + delta);
          const sellingPrice = p.unitPrice * (1 + (p.markup || 0) / 100);
          return { ...p, quantity: newQty, total: newQty * sellingPrice };
        }
        return p;
      }),
    }));
  };
}

// Calculate proposal totals
export function createCalculators(
  selectedProducts: ProposalProduct[],
  discount: number,
) {
  const calculateSubtotal = () =>
    selectedProducts.reduce((sum, p) => sum + p.total, 0);
  const calculateDiscount = () => (calculateSubtotal() * (discount || 0)) / 100;
  const calculateTotal = () => calculateSubtotal() - calculateDiscount();

  return { calculateSubtotal, calculateDiscount, calculateTotal };
}

// Extract extra products (not linked to systems)
export function getExtraProducts(
  selectedProducts: ProposalProduct[],
  selectedSistemas: ProposalSistema[],
) {
  const sistemaProductIds = new Set(
    selectedSistemas.flatMap((s) => {
      // Handle both new and legacy formats
      if (s.ambientes && s.ambientes.length > 0) {
        return s.ambientes.flatMap(a => a.products.map(p => p.productId));
      }
      return (s.products || []).map((p) => p.productId);
    }),
  );
  return selectedProducts.filter(
    (p) => !p.systemInstanceId && !p.ambienteInstanceId && !sistemaProductIds.has(p.productId),
  );
}
