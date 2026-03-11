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
import {
  KanbanService,
  KanbanStatusColumn,
  getDefaultProposalColumns,
} from "@/services/kanban-service";
import { useTenant } from "@/providers/tenant-provider";

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
  const { tenant } = useTenant();
  const [dynamicStatusOptions, setDynamicStatusOptions] = React.useState<
    {
      value: string;
      label: string;
    }[]
  >([...statusOptions.filter((o) => o.value !== "draft")]);

  React.useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    KanbanService.getStatuses(tenant.id)
      .then((columns) => {
        if (cancelled) return;
        let activeColumns = columns;
        if (activeColumns.length === 0) {
          activeColumns = getDefaultProposalColumns().map(
            (c, i) => ({ ...c, id: `default_${i}` }) as KanbanStatusColumn,
          );
        }

        const newOptions = [
          ...activeColumns.map((c) => ({
            value:
              c.id.startsWith("default_") && c.mappedStatus
                ? c.mappedStatus
                : c.id,
            label: c.label,
          })),
        ];

        // If the current proposal has a status that isn't in the new columns (e.g. an old status string like "in_progress")
        if (
          formData.status &&
          formData.status !== "draft" &&
          !newOptions.some((o) => o.value === formData.status)
        ) {
          // Find if there's an active column that maps to this old status
          const mappedColumn = activeColumns.find(
            (c) =>
              c.mappedStatus === formData.status || c.id === formData.status,
          );

          if (mappedColumn) {
            const actualValueToSave =
              mappedColumn.id.startsWith("default_") &&
              mappedColumn.mappedStatus
                ? mappedColumn.mappedStatus
                : mappedColumn.id;
            
            // Auto-update the form data to use the new column ID instead of the old status string
            onFormChange({
              target: {
                name: "status",
                value: actualValueToSave,
              },
            } as React.ChangeEvent<HTMLSelectElement>);
          } else {
            // If no active column maps to it, add it as a fallback option so it doesn't break
            const fallback = statusOptions.find(
              (o) => o.value === formData.status,
            );
            if (fallback) {
              newOptions.push({
                value: fallback.value,
                label: fallback.label + " (Antigo)",
              });
            } else {
              newOptions.push({
                value: formData.status,
                label: "Desconhecido (Antigo)",
              });
            }
          }
        }

        setDynamicStatusOptions(newOptions);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, formData.status, onFormChange]);

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
          statusOptions={dynamicStatusOptions}
        />

        {/* Payment Summary (read-only) */}
        <PaymentConditionsSummary formData={formData} totalValue={totalValue} />
      </CardContent>
    </Card>
  );
}
