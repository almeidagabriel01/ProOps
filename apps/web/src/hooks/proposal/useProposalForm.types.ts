import * as React from "react";
import { useRouter } from "next/navigation";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ProposalTemplate } from "@/types";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ProposalSistema, Sistema } from "@/types/automation";
import { Ambiente } from "@/services/ambiente-service";
import { MasterDataAction } from "./useMasterDataTransaction";
import { ClientType } from "@/services/client-service";
import { ProposalWorkflow } from "@/lib/niches/config";
import { ProposalProductPricingDetails } from "@/lib/product-pricing";

export interface UseProposalFormProps {
  proposalId?: string;
}

export interface UseProposalFormReturn {
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  products: Array<Product | Service>;
  template: ProposalTemplate | null;
  selectedClientId: string | undefined;
  isNewClient: boolean;
  clientTypes: ClientType[];
  formData: Partial<Proposal>;
  selectedProducts: ProposalProduct[];
  visibleProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  systemProductIds: Set<string>;
  extraProducts: ProposalProduct[];
  showLimitModal: boolean;
  currentProposalCount: number;

  setSelectedClientId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setIsNewClient: React.Dispatch<React.SetStateAction<boolean>>;
  setClientTypes: React.Dispatch<React.SetStateAction<ClientType[]>>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
  setSelectedSistemas: React.Dispatch<React.SetStateAction<ProposalSistema[]>>;
  setSystemProductIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setShowLimitModal: React.Dispatch<React.SetStateAction<boolean>>;

  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  handleSubmit: (
    e: React.FormEvent,
    options?: { finalize?: boolean },
  ) => Promise<boolean>;
  toggleProduct: (product: Product | Service) => void;
  updateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  removeProduct: (
    productId: string,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  handleToggleProductStatus: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => Promise<void>;

  calculateSubtotal: () => number;
  calculateDiscount: () => number;
  calculateTotal: () => number;

  router: ReturnType<typeof useRouter>;
  tenant: ReturnType<typeof useTenant>["tenant"];
  features: ReturnType<typeof usePlanLimits>["features"];
  primaryColor: string;
  isAutomacaoNiche: boolean;
  isEnvironmentProposal: boolean;
  proposalWorkflow: ProposalWorkflow;

  mergedAmbientes: Ambiente[];
  mergedSistemas: Sistema[];
  handleAmbienteAction: (action: MasterDataAction) => void;
  handleSistemaAction: (action: MasterDataAction) => void;
  addSistema: (sistema: ProposalSistema) => void;
  removeSistema: (index: number, systemInstanceId: string) => void;
  updateSistema: (index: number, updatedSistema: ProposalSistema) => void;
  addProductToSystem: (
    product: Product | Service,
    systemIndex: number,
    systemInstanceId: string,
  ) => void;
  updateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  updateProductPrice: (
    productId: string,
    newPrice: number,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  resetProductPrice: (
    productId: string,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  updateProductPricingDetails: (
    productId: string,
    pricingDetails: ProposalProductPricingDetails,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  removeAmbienteFromSistema: (sistemaIndex: number, ambienteId: string) => void;
  resetToInitial: () => void;
  markAsDiscarded: () => void;
}
