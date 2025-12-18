"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Loader2, Package } from "lucide-react";
import {
    FormContainer,
    FormHeader,
} from "@/components/ui/form-components";
import { ProductFormNew } from "../_components/product-form-new";

export default function NewProductPage() {
    const router = useRouter();
    const { canCreate, isLoading } = usePagePermission("products");

    useEffect(() => {
        if (!isLoading && !canCreate) {
            router.push("/products");
        }
    }, [isLoading, canCreate, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <FormContainer>
            <FormHeader
                title="Novo Produto"
                subtitle="Adicione um novo produto ao seu catálogo com todas as informações necessárias"
                icon={Package}
                onBack={() => router.push("/products")}
            />
            <ProductFormNew />
        </FormContainer>
    );
}
