/**
 * Hook: useProductActions
 *
 * Securely manages product operations via Firebase Cloud Functions.
 * Replaces direct Firestore writes.
 */

import { useState } from "react";
import { toast } from '@/lib/toast';
import { callApi } from "@/lib/api-client";

// ============================================
// TYPES
// ============================================

export interface CreateProductData {
  name: string;
  description?: string;
  price: string;
  markup?: string;
  manufacturer?: string;
  category?: string;
  stock?: number;
  status?: string;
  images?: string[];
  targetTenantId?: string;
}

interface CreateProductResult {
  success: boolean;
  productId: string;
  message: string;
}

interface UpdateProductOptions {
  productName?: string;
  context?: "general" | "stock";
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

const formatProductLabel = (name?: string, fallback = "produto"): string => {
  const value = name?.trim();
  return value ? `"${value}"` : fallback;
};

// ============================================
// HOOK
// ============================================

export function useProductActions() {
  const [isLoading, setIsLoading] = useState(false);

  const createProduct = async (
    data: CreateProductData,
  ): Promise<CreateProductResult | null> => {
    setIsLoading(true);
    try {
      const payload = {
        name: data.name,
        description: data.description || "",
        price: data.price,
        markup: data.markup || "",
        manufacturer: data.manufacturer || "",
        category: data.category || "",
        stock: data.stock ?? 0,
        status: data.status || "active",
        images: data.images || [],
        targetTenantId: data.targetTenantId,
      };

      const result = await callApi<CreateProductResult>(
        "v1/products",
        "POST",
        payload,
      );

      const productLabel = formatProductLabel(data.name, "novo produto");
      toast.success(`Produto ${productLabel} criado com sucesso.`, {
        title: "Sucesso ao criar",
      });
      return result;
    } catch (error: unknown) {
      console.error("Error creating product:", error);
      const productLabel = formatProductLabel(data.name, "novo produto");
      const message = getErrorMessage(error, "Falha ao criar produto.");
      toast.error(
        `Nao foi possivel criar o produto ${productLabel}. Detalhes: ${message}`,
        { title: "Erro ao criar" },
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProduct = async (
    productId: string,
    data: Partial<CreateProductData>,
    options?: UpdateProductOptions,
  ): Promise<boolean> => {
    if (!productId) return false;

    // Don't set global loading state to avoid full page UI block for small updates
    // setIsLoading(true);
    try {
      await callApi<{ success: boolean; message: string }>(
        `v1/products/${productId}`,
        "PUT",
        data,
      );

      const productLabel = formatProductLabel(
        options?.productName || data.name,
      );
      const successMessage =
        options?.context === "stock" && typeof data.stock === "number"
          ? `Estoque do produto ${productLabel} atualizado para ${data.stock}.`
          : `Produto ${productLabel} atualizado com sucesso.`;

      toast.success(successMessage, { title: "Sucesso ao editar" });
      return true;
    } catch (error: unknown) {
      console.error("Error updating product:", error);
      const productLabel = formatProductLabel(
        options?.productName || data.name,
      );
      const message = getErrorMessage(error, "Falha ao editar produto.");
      toast.error(
        `Nao foi possivel editar o produto ${productLabel}. Detalhes: ${message}`,
        { title: "Erro ao editar" },
      );
      return false;
    }
  };

  const deleteProduct = async (
    productId: string,
    productName?: string,
  ): Promise<boolean> => {
    if (!productId) return false;

    setIsLoading(true);
    try {
      await callApi<{ success: boolean; message: string }>(
        `v1/products/${productId}`,
        "DELETE",
      );

      const productLabel = formatProductLabel(productName);
      toast.success(`Produto ${productLabel} foi excluido com sucesso.`, {
        title: "Sucesso ao excluir",
      });
      return true;
    } catch (error: unknown) {
      console.error("Error deleting product:", error);
      const productLabel = formatProductLabel(productName);
      const message = getErrorMessage(error, "Falha ao excluir produto.");
      toast.error(
        `Nao foi possivel excluir o produto ${productLabel}. Detalhes: ${message}`,
        { title: "Erro ao excluir" },
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createProduct,
    updateProduct,
    deleteProduct,
    isLoading,
  };
}
