"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ProposalProduct, Proposal } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalStatus } from "@/types/proposal";
import { FileText, Percent, Tag } from "lucide-react";

const statusOptions: { value: ProposalStatus; label: string }[] = [
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
  products?: Product[]; // Full product list for status checking
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
  // Helper to check if product is inactive
  const isProductInactive = (product: ProposalProduct) => {
    // Check if product is inactive in catalog OR marked as inactive in proposal
    const catalogProduct = products.find((p) => p.id === product.productId);
    return (
      catalogProduct?.status === "inactive" || product.status === "inactive"
    );
  };
  if (selectedProducts.length === 0) {
    return null;
  }

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
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">Produto</th>
                <th className="text-center p-3 w-16">Qtd</th>
                <th className="text-right p-3 w-36">Unit.</th>
                <th className="text-right p-3 w-36">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Produtos agrupados por sistema */}
              {isAutomacaoNiche &&
                selectedSistemas.map((sistema, sistemaIdx) => {
                  // Fallback for legacy structure or if key 'ambientes' is missing
                  const environments =
                    sistema.ambientes && sistema.ambientes.length > 0
                      ? sistema.ambientes
                      : sistema.ambienteId
                        ? [
                            {
                              ambienteId: sistema.ambienteId,
                              ambienteName: sistema.ambienteName || "Ambiente",
                            },
                          ]
                        : [];

                  return (
                    <React.Fragment key={`sistema-group-${sistemaIdx}`}>
                      {environments.map((ambiente, envIdx) => {
                        const systemInstanceId = `${sistema.sistemaId}-${ambiente.ambienteId}`;
                        const sistemaProducts = selectedProducts.filter(
                          (p) => p.systemInstanceId === systemInstanceId,
                        );

                        // If no products found for this exact instance ID, try checking if products belong to these IDs
                        // (sometimes migration might be tricky, but usually systemInstanceId is the key)

                        const instanceTotal = sistemaProducts.reduce(
                          (sum, p) => sum + p.total,
                          0,
                        );

                        if (sistemaProducts.length === 0) return null;

                        return (
                          <React.Fragment
                            key={`sistema-${sistemaIdx}-env-${envIdx}`}
                          >
                            <tr
                              className="border-t"
                              style={{ backgroundColor: `${primaryColor}15` }}
                            >
                              <td
                                colSpan={4}
                                className="p-2 font-semibold text-sm"
                              >
                                <div className="flex flex-row items-center gap-3">
                                  <span className="font-bold text-base text-gray-700 dark:text-gray-300">
                                    {sistema.sistemaName}
                                  </span>
                                  <span className="font-medium text-xs px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border shadow-xs flex items-center gap-1 text-foreground">
                                    📍 {ambiente.ambienteName}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {sistemaProducts.map((product, idx) => (
                              <tr
                                key={`${product.productId}-${idx}`}
                                className="border-t"
                              >
                                <td className="p-3 font-medium pl-6">
                                  <div className="flex items-center gap-2">
                                    <span>{product.productName}</span>
                                    {product.isExtra && (
                                      <Badge
                                        variant="default"
                                        className="text-[10px] h-5 px-1 bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
                                      >
                                        Extra
                                      </Badge>
                                    )}
                                    {isProductInactive(product) && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] h-5 px-1 bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-300"
                                      >
                                        Inativo
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  {product.quantity}
                                </td>
                                <td className="p-3 text-right whitespace-nowrap">
                                  R${" "}
                                  {(
                                    (product.unitPrice || 0) *
                                    (1 + (product.markup || 0) / 100)
                                  ).toFixed(2)}
                                </td>
                                <td className="p-3 text-right font-medium whitespace-nowrap">
                                  R$ {(product.total || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-muted/30">
                              <td
                                colSpan={3}
                                className="p-2 text-right text-sm pl-6 whitespace-nowrap"
                              >
                                Subtotal ({ambiente.ambienteName}):
                              </td>
                              <td className="p-2 text-right font-medium text-sm whitespace-nowrap text-foreground">
                                R$ {(instanceTotal || 0).toFixed(2)}
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

              {/* Produtos extras */}
              {isAutomacaoNiche && extraProducts.length > 0 && (
                <React.Fragment>
                  <tr className="border-t bg-gray-100">
                    <td
                      colSpan={4}
                      className="p-2 font-semibold text-sm text-gray-600 dark:text-gray-300"
                    >
                      📦 Produtos Extras (não vinculados a sistemas)
                    </td>
                  </tr>
                  {extraProducts.map((product) => (
                    <tr key={product.productId} className="border-t">
                      <td className="p-3 font-medium pl-6">
                        <div className="flex items-center gap-2">
                          <span>{product.productName}</span>
                          <span className="ml-2 text-xs text-gray-400">
                            (Extra)
                          </span>
                          {isProductInactive(product) && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 px-1 bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-300"
                            >
                              Inativo
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">{product.quantity}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        R${" "}
                        {(
                          product.unitPrice *
                          (1 + (product.markup || 0) / 100)
                        ).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-medium whitespace-nowrap">
                        R$ {product.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              )}

              {/* Para nicho não-automação */}
              {!isAutomacaoNiche &&
                selectedProducts.map((product) => (
                  <tr key={product.productId} className="border-t">
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{product.productName}</span>
                        {isProductInactive(product) && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1 bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-300"
                          >
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">{product.quantity}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      R${" "}
                      {(
                        product.unitPrice *
                        (1 + (product.markup || 0) / 100)
                      ).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">
                      R$ {product.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="bg-muted/50">
              {(() => {
                const subtotal = calculateSubtotal();
                const discount = calculateDiscount();

                // Calculate profit from markup
                const totalProfit = selectedProducts.reduce((sum, p) => {
                  const basePrice = p.unitPrice * p.quantity;
                  const profit = basePrice * ((p.markup || 0) / 100);
                  return sum + profit;
                }, 0);

                const extraExpense = formData.extraExpense || 0;
                const totalValue = calculateTotal();

                return (
                  <>
                    {/* Cost row (without markup) - only visible in UI, not PDF */}
                    {(() => {
                      const totalCost = selectedProducts.reduce((sum, p) => {
                        return sum + p.unitPrice * p.quantity;
                      }, 0);
                      return (
                        <tr className="no-pdf-export border-t">
                          <td
                            colSpan={3}
                            className="p-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap text-sm"
                          >
                            Custo (sem markup):
                          </td>
                          <td className="p-3 text-right font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap text-sm">
                            R$ {totalCost.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })()}

                    <tr className="border-t">
                      <td
                        colSpan={3}
                        className="p-3 text-right whitespace-nowrap"
                      >
                        Subtotal:
                      </td>
                      <td className="p-3 text-right font-medium whitespace-nowrap">
                        R$ {subtotal.toFixed(2)}
                      </td>
                    </tr>

                    {/* Profit row - only visible in UI, not PDF */}
                    {totalProfit > 0 && (
                      <tr className="no-pdf-export">
                        <td
                          colSpan={3}
                          className="p-3 text-right text-green-600 dark:text-green-400 whitespace-nowrap text-sm"
                        >
                          Lucro (Markup):
                        </td>
                        <td className="p-3 text-right font-medium text-green-600 dark:text-green-400 whitespace-nowrap text-sm">
                          R$ {totalProfit.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {(formData.discount || 0) > 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-3 text-right text-destructive whitespace-nowrap"
                        >
                          Desconto ({formData.discount}%):
                        </td>
                        <td className="p-3 text-right font-medium text-destructive whitespace-nowrap">
                          - R$ {discount.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {/* Extra Expense row - only visible in UI, not PDF */}
                    {extraExpense > 0 && (
                      <tr className="no-pdf-export">
                        <td
                          colSpan={3}
                          className="p-3 text-right text-orange-600 dark:text-orange-400 whitespace-nowrap text-sm"
                        >
                          Custos Extras:
                        </td>
                        <td className="p-3 text-right font-medium text-orange-600 dark:text-orange-400 whitespace-nowrap text-sm">
                          + R$ {extraExpense.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    <tr className="border-t-2 border-primary">
                      <td
                        colSpan={3}
                        className="p-3 text-right text-lg font-bold whitespace-nowrap"
                      >
                        Total:
                      </td>
                      <td className="p-3 text-right text-lg font-bold text-primary dark:text-white whitespace-nowrap">
                        R$ {totalValue.toFixed(2)}
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tfoot>
          </table>
        </div>
        <div className="flex justify-between">
          {/* Discount */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="discount">Desconto:</Label>
            </div>
            <Input
              id="discount"
              name="discount"
              type="number"
              min={0}
              max={100}
              value={formData.discount || 0}
              onChange={onFormChange}
              className="w-24"
            />
            <span className="text-muted-foreground">%</span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="status">Status:</Label>
            </div>
            <Select
              id="status"
              name="status"
              value={formData.status || "in_progress"}
              onChange={onFormChange}
              className="w-40"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Payment Summary (read-only) */}
        {formData.installmentsEnabled && (
          <div className="border rounded-xl p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 text-primary"
                >
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </div>
              <span className="font-semibold text-sm">
                Condições de Pagamento
              </span>
            </div>
            <div className="text-sm space-y-1.5 text-muted-foreground">
              {formData.downPaymentEnabled &&
                formData.downPaymentValue &&
                formData.downPaymentValue > 0 && (
                  <p>
                    • Entrada:{" "}
                    <span className="font-semibold text-foreground">
                      R${" "}
                      {(formData.downPaymentValue || 0).toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                    </span>
                    {formData.downPaymentDueDate && (
                      <span className="text-xs ml-2">
                        (venc:{" "}
                        {new Date(
                          formData.downPaymentDueDate + "T12:00:00",
                        ).toLocaleDateString("pt-BR")}
                        )
                      </span>
                    )}
                  </p>
                )}
              <p>
                • Parcelas:{" "}
                <span className="font-semibold text-foreground">
                  {formData.installmentsCount || 1}x de R${" "}
                  {(formData.installmentValue || 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                {formData.firstInstallmentDate && (
                  <span className="text-xs ml-2">
                    (1ª venc:{" "}
                    {new Date(
                      formData.firstInstallmentDate + "T12:00:00",
                    ).toLocaleDateString("pt-BR")}
                    )
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Custom Notes */}
        <div className="grid gap-2">
          <Label htmlFor="customNotes">Observações Adicionais</Label>
          <Textarea
            id="customNotes"
            name="customNotes"
            value={formData.customNotes || ""}
            onChange={onFormChange}
            placeholder="Notas ou condições especiais para esta proposta..."
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
