"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ProposalProduct, Proposal } from "@/services/proposal-service";
import { Package, User } from "lucide-react";

interface ProposalReadOnlyViewProps {
    formData: Partial<Proposal>;
    selectedProducts: ProposalProduct[];
    calculateSubtotal: () => number;
    calculateDiscount: () => number;
    calculateTotal: () => number;
}

export function ProposalReadOnlyView({
    formData,
    selectedProducts,
    calculateSubtotal,
    calculateDiscount,
    calculateTotal,
}: ProposalReadOnlyViewProps) {
    return (
        <div className="space-y-6">
            {/* Client Info Read Only */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Dados do Cliente
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Título da Proposta</Label>
                            <div className="p-2 border rounded-md bg-muted/50">{formData.title}</div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Cliente</Label>
                            <div className="p-2 border rounded-md bg-muted/50">{formData.clientName}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label>Email</Label>
                            <div className="p-2 border rounded-md bg-muted/50">
                                {formData.clientEmail || "-"}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Telefone</Label>
                            <div className="p-2 border rounded-md bg-muted/50">
                                {formData.clientPhone || "-"}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Válida até</Label>
                            <div className="p-2 border rounded-md bg-muted/50">
                                {formData.validUntil
                                    ? new Date(formData.validUntil).toLocaleDateString()
                                    : "-"}
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Endereço</Label>
                        <div className="p-2 border rounded-md bg-muted/50">
                            {formData.clientAddress || "-"}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Products Read Only */}
            <Card>
                <CardHeader>
                    <CardTitle>Produtos Selecionados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {selectedProducts.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                            Nenhum produto selecionado.
                        </p>
                    ) : (
                        selectedProducts.map((product, idx) => (
                            <div
                                key={`${product.productId}-${idx}`}
                                className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                            >
                                <div className="flex items-center gap-3">
                                    {product.productImage || product.productImages?.[0] ? (
                                        <div className="w-8 h-8 rounded border bg-white overflow-hidden flex-shrink-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={product.productImages?.[0] || product.productImage}
                                                alt=""
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <Package className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <div>
                                        <div className="font-medium text-sm">{product.productName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            R$ {product.unitPrice.toFixed(2)} x {product.quantity}
                                        </div>
                                    </div>
                                </div>
                                <div className="font-semibold text-sm">
                                    R$ {product.total.toFixed(2)}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>R$ {calculateSubtotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-emerald-600">
                            <span>Desconto ({formData.discount}%):</span>
                            <span>- R$ {calculateDiscount().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                            <span>Total:</span>
                            <span>R$ {calculateTotal().toFixed(2)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notes Read Only */}
            <Card>
                <CardHeader>
                    <CardTitle>Notas Observações</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="p-2 border rounded-md bg-muted/50 min-h-[100px] whitespace-pre-wrap">
                        {formData.customNotes || "Nenhuma observação."}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
