"use client";

import * as React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { ProposalSistema } from "@/types/automation";
import { getContrastTextColor } from "@/utils/color-utils";
import {
    Package,
    Plus,
    Minus,
    Cpu,
    Trash2,
    Pencil,
} from "lucide-react";

interface ProposalSystemsSectionProps {
    selectedSistemas: ProposalSistema[];
    selectedProducts: ProposalProduct[];
    products: Product[];
    primaryColor: string;
    selectorKey: number;
    onEditSystem: (index: number) => void;
    onRemoveSystem: (index: number, systemInstanceId: string) => void;
    onUpdateProductQuantity: (productId: string, delta: number, systemInstanceId: string) => void;
    onAddExtraProductToSystem: (product: Product, sistemaIndex: number, systemInstanceId: string) => void;
    onAddNewSystem: (sistema: ProposalSistema) => void;
    SistemaSelectorComponent: React.ComponentType<any>;
}

export function ProposalSystemsSection({
    selectedSistemas,
    selectedProducts,
    products,
    primaryColor,
    selectorKey,
    onEditSystem,
    onRemoveSystem,
    onUpdateProductQuantity,
    onAddExtraProductToSystem,
    onAddNewSystem,
    SistemaSelectorComponent,
}: ProposalSystemsSectionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Cpu className="w-5 h-5" />
                    Sistemas de Automação
                </CardTitle>
                <CardDescription>
                    Adicione um ou mais sistemas de automação à proposta
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Lista de sistemas já adicionados */}
                {selectedSistemas.length > 0 && (
                    <div className="space-y-4">
                        {selectedSistemas.map((sistema, sistemaIndex) => {
                            const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
                            const sistemaProducts = selectedProducts.filter(
                                (p) => p.systemInstanceId === systemInstanceId
                            );
                            const sistemaTotal = sistemaProducts.reduce(
                                (sum, p) => sum + p.total,
                                0
                            );

                            return (
                                <SystemCard
                                    key={systemInstanceId}
                                    sistema={sistema}
                                    sistemaIndex={sistemaIndex}
                                    sistemaProducts={sistemaProducts}
                                    sistemaTotal={sistemaTotal}
                                    products={products}
                                    primaryColor={primaryColor}
                                    systemInstanceId={systemInstanceId}
                                    onEdit={() => onEditSystem(sistemaIndex)}
                                    onRemove={() => onRemoveSystem(sistemaIndex, systemInstanceId)}
                                    onUpdateQuantity={(productId, delta) =>
                                        onUpdateProductQuantity(productId, delta, systemInstanceId)
                                    }
                                    onAddExtraProduct={(product) =>
                                        onAddExtraProductToSystem(product, sistemaIndex, systemInstanceId)
                                    }
                                />
                            );
                        })}
                    </div>
                )}

                {/* Adicionar novo sistema */}
                <div className="border-2 border-dashed rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-3 text-center">
                        {selectedSistemas.length === 0
                            ? "Selecione o primeiro sistema para esta proposta"
                            : "+ Adicionar outro sistema"}
                    </p>
                    <SistemaSelectorComponent
                        key={selectorKey}
                        value={null}
                        onChange={onAddNewSystem}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

// Sub-component for individual system card
interface SystemCardProps {
    sistema: ProposalSistema;
    sistemaIndex: number;
    sistemaProducts: ProposalProduct[];
    sistemaTotal: number;
    products: Product[];
    primaryColor: string;
    systemInstanceId: string;
    onEdit: () => void;
    onRemove: () => void;
    onUpdateQuantity: (productId: string, delta: number) => void;
    onAddExtraProduct: (product: Product) => void;
}

function SystemCard({
    sistema,
    sistemaProducts,
    sistemaTotal,
    products,
    primaryColor,
    onEdit,
    onRemove,
    onUpdateQuantity,
    onAddExtraProduct,
}: SystemCardProps) {
    return (
        <div
            className="rounded-lg overflow-hidden shadow-sm"
            style={{
                border: `2px solid ${primaryColor}`,
                backgroundColor: `${primaryColor}08`,
            }}
        >
            {/* Header do Sistema */}
            <div
                className="p-4 flex items-center justify-between"
                style={{ backgroundColor: `${primaryColor}15` }}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <Cpu className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span
                                className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded flex-shrink-0"
                                style={{
                                    backgroundColor: primaryColor,
                                    color: getContrastTextColor(primaryColor),
                                }}
                            >
                                📍 {sistema.ambienteName}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-lg text-foreground truncate">
                                {sistema.sistemaName}
                            </h4>
                        </div>
                        {sistema.description && (
                            <p className="mt-1 text-sm text-foreground leading-relaxed break-words">
                                {sistema.description}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <span className="font-bold text-lg" style={{ color: primaryColor }}>
                        R$ {sistemaTotal.toFixed(2)}
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={onEdit}
                        title="Trocar Sistema/Ambiente"
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={onRemove}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Produtos do Sistema */}
            <div className="p-4 space-y-2 bg-background">
                {sistemaProducts.length > 0 ? (
                    sistemaProducts.map((product, idx) => (
                        <ProductRow
                            key={`${product.productId}-${idx}`}
                            product={product}
                            onUpdateQuantity={onUpdateQuantity}
                        />
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhum produto neste sistema
                    </p>
                )}

                {/* Adicionar Produto Extra */}
                <ExtraProductsGrid
                    products={products}
                    sistemaProducts={sistemaProducts}
                    primaryColor={primaryColor}
                    onAddProduct={onAddExtraProduct}
                />
            </div>
        </div>
    );
}

// Sub-component for product row
interface ProductRowProps {
    product: ProposalProduct;
    onUpdateQuantity: (productId: string, delta: number) => void;
}

function ProductRow({ product, onUpdateQuantity }: ProductRowProps) {
    return (
        <div
            className={`flex items-center justify-between p-3 rounded-lg border ${product.isExtra ? "bg-blue-50/50 border-blue-100" : "bg-muted/30"
                }`}
        >
            <div className="flex items-center gap-3">
                {product.productImage || product.productImages?.[0] ? (
                    <div className="w-8 h-8 rounded border bg-card overflow-hidden flex-shrink-0">
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
                    <div className="flex items-center gap-2">
                        <h5 className="font-medium text-sm">{product.productName}</h5>
                        {product.isExtra && (
                            <Badge
                                variant="default"
                                className="text-[10px] h-5 px-1 bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
                            >
                                Extra
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {product.productDescription || "Sem descrição"}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdateQuantity(product.productId, -1)}
                >
                    <Minus className="w-3 h-3" />
                </Button>
                <span className="font-bold w-6 text-center text-sm">{product.quantity}</span>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdateQuantity(product.productId, 1)}
                >
                    <Plus className="w-3 h-3" />
                </Button>
                <span className="font-semibold text-sm ml-2">
                    R$ {product.total.toFixed(2)}
                </span>
            </div>
        </div>
    );
}

// Sub-component for extra products grid
interface ExtraProductsGridProps {
    products: Product[];
    sistemaProducts: ProposalProduct[];
    primaryColor: string;
    onAddProduct: (product: Product) => void;
}

function ExtraProductsGrid({
    products,
    sistemaProducts,
    primaryColor,
    onAddProduct,
}: ExtraProductsGridProps) {
    const availableProducts = products.filter(
        (p) => !sistemaProducts.some((sp) => sp.productId === p.id)
    );

    if (availableProducts.length === 0) {
        return (
            <div
                className="mt-4 p-4 rounded-lg"
                style={{
                    backgroundColor: `${primaryColor}08`,
                    border: `2px dashed ${primaryColor}40`,
                }}
            >
                <p className="text-sm text-muted-foreground italic text-center py-2">
                    Todos os produtos disponíveis já foram adicionados a este sistema.
                </p>
            </div>
        );
    }

    return (
        <div
            className="mt-4 p-4 rounded-lg"
            style={{
                backgroundColor: `${primaryColor}08`,
                border: `2px dashed ${primaryColor}40`,
            }}
        >
            <div className="flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4" style={{ color: primaryColor }} />
                <span className="text-sm font-semibold" style={{ color: primaryColor }}>
                    Adicionar Produto Extra a este Sistema
                </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableProducts.slice(0, 9).map((product) => (
                    <button
                        key={product.id}
                        type="button"
                        className="flex items-center gap-2 p-2 text-left rounded-lg border bg-background hover:border-primary hover:shadow-sm transition-all"
                        onClick={() => onAddProduct(product)}
                    >
                        <Plus className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{product.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                                R$ {parseFloat(product.price).toFixed(2)}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
