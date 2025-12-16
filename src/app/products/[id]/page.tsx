"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProductForm } from "../_components/product-form";
import { Product, ProductService } from "@/services/product-service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { usePagePermission } from "@/hooks/usePagePermission";

export default function EditProductPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { canEdit, canView, isLoading } = usePagePermission("products");

    useEffect(() => {
        if (!isLoading && !canView) {
            router.push("/products");
        }
    }, [isLoading, canView, router]);

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadProduct = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const data = await ProductService.getProductById(id);
                if (data) {
                    setProduct(data);
                } else {
                    setError("Produto não encontrado.");
                }
            } catch (err) {
                console.error(err);
                setError("Erro ao carregar produto.");
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-muted-foreground">Carregando produto...</div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <h2 className="text-xl font-semibold text-destructive">{error || "Produto não encontrado"}</h2>
                <Button variant="outline" onClick={() => router.push("/products")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para Lista
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {canEdit ? "Editar Produto" : "Visualizar Produto"}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {canEdit
                            ? `Atualize as informações do produto ${product.name}.`
                            : `Visualizando informações do produto ${product.name}.`
                        }
                    </p>
                </div>
            </div>

            <div className="h-4" /> {/* Spacer */}

            <ProductForm initialData={product} productId={id} isReadOnly={!canEdit} />
        </div>
    );
}
