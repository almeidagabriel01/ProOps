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
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Package, Plus, Minus } from "lucide-react";

interface ProposalProductsSectionProps {
    products: Product[];
    selectedProducts: ProposalProduct[];
    extraProducts: ProposalProduct[];
    systemProductIds: Set<string>;
    onToggleProduct: (product: Product) => void;
    onUpdateQuantity: (productId: string, delta: number) => void;
    onNavigateToProducts: () => void;
}

export function ProposalProductsSection({
    products,
    extraProducts,
    systemProductIds,
    onToggleProduct,
    onUpdateQuantity,
    onNavigateToProducts,
}: ProposalProductsSectionProps) {
    if (products.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Produtos Extras (Avulsos)
                    </CardTitle>
                    <CardDescription>
                        Selecione produtos que NÃO fazem parte dos sistemas acima
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum produto cadastrado</p>
                        <Button variant="link" onClick={onNavigateToProducts}>
                            Cadastrar produtos
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Filter out products that are already in systems
    const availableProducts = products.filter((product) => !systemProductIds.has(product.id));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Produtos Extras (Avulsos)
                </CardTitle>
                <CardDescription>
                    Selecione produtos que NÃO fazem parte dos sistemas acima
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableProducts.map((product) => {
                        const selected = extraProducts.find((p) => p.productId === product.id);

                        return (
                            <ProductCard
                                key={product.id}
                                product={product}
                                selected={selected}
                                onToggle={() => onToggleProduct(product)}
                                onUpdateQuantity={onUpdateQuantity}
                            />
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

interface ProductCardProps {
    product: Product;
    selected?: ProposalProduct;
    onToggle: () => void;
    onUpdateQuantity: (productId: string, delta: number) => void;
}

function ProductCard({ product, selected, onToggle, onUpdateQuantity }: ProductCardProps) {
    return (
        <div
            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${selected
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50"
                }`}
            onClick={onToggle}
        >
            {/* Product Image */}
            {(product.images?.[0] || product.image) && (
                <div className="flex justify-center mb-3">
                    <div className="w-16 h-16 rounded-lg border bg-card overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={product.images?.[0] || product.image || ""}
                            alt=""
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <h4 className="font-medium mr-2">{product.name}</h4>
                </div>
                <span className="text-sm font-bold text-primary whitespace-nowrap">
                    R$ {parseFloat(product.price).toFixed(2)}
                </span>
            </div>

            {product.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {product.description}
                </p>
            )}

            {selected && (
                <div
                    className="flex items-center justify-center gap-2 mt-3 pt-3 border-t"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(product.id, -1)}
                    >
                        <Minus className="w-3 h-3" />
                    </Button>
                    <span className="font-bold w-8 text-center">{selected.quantity}</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(product.id, 1)}
                    >
                        <Plus className="w-3 h-3" />
                    </Button>
                </div>
            )}
        </div>
    );
}
