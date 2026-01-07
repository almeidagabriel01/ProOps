"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ProposalProduct, Proposal } from "@/services/proposal-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalStatus } from "@/types/proposal";
import { FileText, Percent, Tag } from "lucide-react";

const statusOptions: { value: ProposalStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
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
  calculateSubtotal: () => number;
  calculateDiscount: () => number;
  calculateTotal: () => number;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
}

export function ProposalSummarySection({
  formData,
  selectedProducts,
  selectedSistemas,
  extraProducts,
  isAutomacaoNiche,
  primaryColor,
  calculateSubtotal,
  calculateDiscount,
  calculateTotal,
  onFormChange,
}: ProposalSummarySectionProps) {
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
                  const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
                  const sistemaProducts = selectedProducts.filter(
                    (p) => p.systemInstanceId === systemInstanceId
                  );
                  const sistemaTotal = sistemaProducts.reduce(
                    (sum, p) => sum + p.total,
                    0
                  );

                  if (sistemaProducts.length === 0) return null;

                  return (
                    <React.Fragment key={`sistema-${sistemaIdx}`}>
                      <tr
                        className="border-t"
                        style={{ backgroundColor: `${primaryColor}15` }}
                      >
                        <td
                          colSpan={4}
                          className="p-2 font-semibold text-sm"
                          style={{ color: primaryColor }}
                        >
                          📍 {sistema.ambienteName} → {sistema.sistemaName}
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
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {product.quantity}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            R$ {product.unitPrice.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-medium whitespace-nowrap">
                            R$ {product.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30">
                        <td
                          colSpan={3}
                          className="p-2 text-right text-sm pl-6 whitespace-nowrap"
                        >
                          Subtotal do Sistema:
                        </td>
                        <td
                          className="p-2 text-right font-medium text-sm whitespace-nowrap"
                          style={{ color: primaryColor }}
                        >
                          R$ {sistemaTotal.toFixed(2)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

              {/* Produtos extras */}
              {isAutomacaoNiche && extraProducts.length > 0 && (
                <React.Fragment>
                  <tr className="border-t bg-gray-100">
                    <td
                      colSpan={4}
                      className="p-2 font-semibold text-sm text-gray-600"
                    >
                      📦 Produtos Extras (não vinculados a sistemas)
                    </td>
                  </tr>
                  {extraProducts.map((product) => (
                    <tr key={product.productId} className="border-t">
                      <td className="p-3 font-medium pl-6">
                        {product.productName}
                        <span className="ml-2 text-xs text-gray-400">
                          (Extra)
                        </span>
                      </td>
                      <td className="p-3 text-center">{product.quantity}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        R$ {product.unitPrice.toFixed(2)}
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
                    <td className="p-3 font-medium">{product.productName}</td>
                    <td className="p-3 text-center">{product.quantity}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      R$ {product.unitPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">
                      R$ {product.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr className="border-t">
                <td colSpan={3} className="p-3 text-right whitespace-nowrap">
                  Subtotal:
                </td>
                <td className="p-3 text-right font-medium whitespace-nowrap">
                  R$ {calculateSubtotal().toFixed(2)}
                </td>
              </tr>
              {(formData.discount || 0) > 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-3 text-right text-destructive whitespace-nowrap"
                  >
                    Desconto ({formData.discount}%):
                  </td>
                  <td className="p-3 text-right font-medium text-destructive whitespace-nowrap">
                    - R$ {calculateDiscount().toFixed(2)}
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
                <td className="p-3 text-right text-lg font-bold text-primary whitespace-nowrap">
                  R$ {calculateTotal().toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

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
            value={formData.status || "draft"}
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
