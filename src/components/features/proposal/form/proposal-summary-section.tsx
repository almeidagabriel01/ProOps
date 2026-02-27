"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProposalProduct, Proposal } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalStatus } from "@/types/proposal";
import { FileText } from "lucide-react";

import { ProposalSummaryTable } from "./summary/proposal-summary-table";
import { ProposalSummaryControls } from "./summary/proposal-summary-controls";
import { PaymentConditionsSummary } from "./summary/payment-conditions-summary";

const statusOptions: { value: ProposalStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "in_progress", label: "Em Aberto" },
  { value: "sent", label: "Enviada" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
];

interface ProposalSummarySectionProps {
  formData: Partial<Proposal>;
  selectedProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  extraProducts: ProposalProduct[];
  isAutomacaoNiche: boolean;
  primaryColor: string;
  products?: Array<Product | Service>; // Full catalog list for status checking
  calculateSubtotal: () => number;
  calculateDiscount: () => number;
  calculateTotal: () => number;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
}

export function ProposalSummarySection({
  formData,
  selectedProducts,
  selectedSistemas,
  extraProducts,
  isAutomacaoNiche,
  primaryColor,
  products = [],
  calculateSubtotal,
  calculateDiscount,
  calculateTotal,
  onFormChange,
}: ProposalSummarySectionProps) {
  if (selectedProducts.length === 0) {
    return null;
  }

  const subtotal = calculateSubtotal();
  const discount = calculateDiscount();
  const totalValue = calculateTotal();
  const extraExpense = formData.extraExpense || 0;

  // The original code used formData.discount which seems to be the percentage value directly from input
  const discountInputValue = formData.discount || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Resumo da Proposta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected Products Table */}
        <ProposalSummaryTable
          selectedProducts={selectedProducts}
          selectedSistemas={selectedSistemas}
          extraProducts={extraProducts}
          isAutomacaoNiche={isAutomacaoNiche}
          primaryColor={primaryColor}
          products={products}
          subtotal={subtotal}
          discount={discount}
          discountPercentage={discountInputValue}
          extraExpense={extraExpense}
          totalValue={totalValue}
        />

        <ProposalSummaryControls
          discount={formData.discount || 0}
          status={formData.status || "draft"}
          customNotes={formData.customNotes || ""}
          onFormChange={onFormChange}
          statusOptions={statusOptions}
        />

        {/* Payment Summary (read-only) */}
        <PaymentConditionsSummary formData={formData} totalValue={totalValue} />
      </CardContent>
    </Card>
  );
}
