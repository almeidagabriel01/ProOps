"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Loader2, Wrench } from "lucide-react";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { ProductFormNew } from "@/app/products/_components/product-form-new";

export default function NewServicePage() {
  const router = useRouter();
  const { canCreate, isLoading } = usePagePermission("services");

  useEffect(() => {
    if (!isLoading && !canCreate) {
      router.push("/services");
    }
  }, [isLoading, canCreate, router]);

  if (isLoading || !canCreate) {
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
        title="Novo Serviço"
        subtitle="Adicione um novo serviço ao seu catálogo"
        icon={Wrench}
        onBack={() => router.push("/services")}
      />
      <ProductFormNew entityType="service" />
    </FormContainer>
  );
}
