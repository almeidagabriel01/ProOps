"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Package } from "lucide-react";
import {
    FormContainer,
    FormHeader,
} from "@/components/ui/form-components";
import { ProductFormNew } from "../_components/product-form-new";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { EntityLoadingState } from "@/components/shared/entity-loading-state";

export default function NewProductPage() {
    const router = useRouter();
    const { canCreate, isLoading } = usePagePermission("products");
    const nicheConfig = useCurrentNicheConfig();

    useEffect(() => {
        if (!isLoading && !canCreate) {
            router.push("/products");
        }
    }, [isLoading, canCreate, router]);

    // Show loading while checking permissions OR while redirecting (no permission)
    if (isLoading || !canCreate) {
        return <EntityLoadingState message="Carregando produto..." />;
    }

    return (
        <FormContainer>
            <FormHeader
                title={nicheConfig.productCatalog.newTitle}
                subtitle="Adicione um novo produto ao seu catálogo com todas as informações necessárias"
                icon={Package}
                onBack={() => router.push("/products")}
            />
            <ProductFormNew />
        </FormContainer>
    );
}

