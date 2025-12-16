"use client";

import Link from "next/link"
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { ProductForm } from "../_components/product-form"

export default function NewProductPage() {
    const router = useRouter();
    const { canCreate, isLoading } = usePagePermission("products");

    useEffect(() => {
        if (!isLoading && !canCreate) {
            router.push("/products");
        }
    }, [isLoading, canCreate, router]);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    }
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/products">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Cadastro de Produto</h1>
                    <p className="text-muted-foreground text-sm">
                        Adicione novos produtos ao catálogo, defina preços e gerencie o estoque.
                    </p>
                </div>
            </div>

            <div className="h-4" /> {/* Spacer */}

            <ProductForm />
        </div>
    )
}
