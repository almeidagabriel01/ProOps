/**
 * Hook: useProductActions
 *
 * Securely manages product operations via Firebase Cloud Functions.
 * Replaces direct Firestore writes.
 */

import { useState } from "react";
import { toast } from "react-toastify";
import { callApi } from "@/lib/api-client";

// ============================================
// TYPES
// ============================================

export interface CreateProductData {
  name: string;
  description?: string;
  price: string;
  manufacturer?: string;
  category?: string;
  sku?: string;
  stock?: string;
  status?: string;
  images?: string[];
  targetTenantId?: string;
}

interface CreateProductResult {
  success: boolean;
  productId: string;
  message: string;
}

interface DeleteProductResult {
  success: boolean;
  message: string;
}

// ============================================
// HOOK
// ============================================

export function useProductActions() {
  const [isLoading, setIsLoading] = useState(false);

  const createProduct = async (
    data: CreateProductData
  ): Promise<CreateProductResult | null> => {
    setIsLoading(true);
    try {
      const payload = {
        name: data.name,
        description: data.description || "",
        price: data.price,
        manufacturer: data.manufacturer || "",
        category: data.category || "",
        sku: data.sku || "",
        stock: data.stock || "0",
        status: data.status || "active",
        images: data.images || [],
        targetTenantId: data.targetTenantId,
      };

      const result = await callApi<CreateProductResult>(
        "v1/products",
        "POST",
        payload
      );

      toast.success("Produto criado com sucesso!");
      return result;
    } catch (error: unknown) {
      console.error("Error creating product:", error);
      const message =
        error instanceof Error ? error.message : "Erro ao criar produto.";
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProduct = async (productId: string): Promise<boolean> => {
    if (!productId) return false;

    setIsLoading(true);
    try {
      await callApi<{ success: boolean; message: string }>(
        `v1/products/${productId}`,
        "DELETE"
      );

      toast.success("Produto removido com sucesso!");
      return true;
    } catch (error: unknown) {
      console.error("Error deleting product:", error);
      const message =
        error instanceof Error ? error.message : "Erro ao deletar produto.";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createProduct,
    deleteProduct,
    isLoading,
  };
}
