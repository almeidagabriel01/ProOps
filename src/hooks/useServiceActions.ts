import { useState } from "react";
import { toast } from '@/lib/toast';
import { callApi } from "@/lib/api-client";

export interface CreateServiceData {
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

interface CreateServiceResult {
  success: boolean;
  serviceId: string;
  message: string;
}

interface UpdateServiceOptions {
  serviceName?: string;
  context?: "general" | "stock";
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

const formatServiceLabel = (name?: string, fallback = "serviço"): string => {
  const value = name?.trim();
  return value ? `"${value}"` : fallback;
};

export function useServiceActions() {
  const [isLoading, setIsLoading] = useState(false);

  const createService = async (
    data: CreateServiceData,
  ): Promise<CreateServiceResult | null> => {
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

      const result = await callApi<CreateServiceResult>(
        "v1/services",
        "POST",
        payload,
      );

      const serviceLabel = formatServiceLabel(data.name, "novo serviço");
      toast.success(`Serviço ${serviceLabel} criado com sucesso.`, {
        title: "Sucesso ao criar",
      });
      return result;
    } catch (error: unknown) {
      console.error("Error creating service:", error);
      const serviceLabel = formatServiceLabel(data.name, "novo serviço");
      const message = getErrorMessage(error, "Falha ao criar serviço.");
      toast.error(
        `Nao foi possivel criar o serviço ${serviceLabel}. Detalhes: ${message}`,
        { title: "Erro ao criar" },
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateService = async (
    serviceId: string,
    data: Partial<CreateServiceData>,
    options?: UpdateServiceOptions,
  ): Promise<boolean> => {
    if (!serviceId) return false;

    try {
      await callApi<{ success: boolean; message: string }>(
        `v1/services/${serviceId}`,
        "PUT",
        data,
      );

      const serviceLabel = formatServiceLabel(
        options?.serviceName || data.name,
      );
      const successMessage =
        options?.context === "stock" && typeof data.stock === "number"
          ? `Estoque do serviço ${serviceLabel} atualizado para ${data.stock}.`
          : `Serviço ${serviceLabel} atualizado com sucesso.`;

      toast.success(successMessage, { title: "Sucesso ao editar" });
      return true;
    } catch (error: unknown) {
      console.error("Error updating service:", error);
      const serviceLabel = formatServiceLabel(
        options?.serviceName || data.name,
      );
      const message = getErrorMessage(error, "Falha ao editar serviço.");
      toast.error(
        `Nao foi possivel editar o serviço ${serviceLabel}. Detalhes: ${message}`,
        { title: "Erro ao editar" },
      );
      return false;
    }
  };

  const deleteService = async (
    serviceId: string,
    serviceName?: string,
  ): Promise<boolean> => {
    if (!serviceId) return false;

    setIsLoading(true);
    try {
      await callApi<{ success: boolean; message: string }>(
        `v1/services/${serviceId}`,
        "DELETE",
      );

      const serviceLabel = formatServiceLabel(serviceName);
      toast.success(`Serviço ${serviceLabel} foi excluido com sucesso.`, {
        title: "Sucesso ao excluir",
      });
      return true;
    } catch (error: unknown) {
      console.error("Error deleting service:", error);
      const serviceLabel = formatServiceLabel(serviceName);
      const message = getErrorMessage(error, "Falha ao excluir serviço.");
      toast.error(
        `Nao foi possivel excluir o serviço ${serviceLabel}. Detalhes: ${message}`,
        { title: "Erro ao excluir" },
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createService,
    updateService,
    deleteService,
    isLoading,
  };
}
