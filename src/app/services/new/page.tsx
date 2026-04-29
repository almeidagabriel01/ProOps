"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Wrench } from "lucide-react";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { ServiceForm } from "../_components/service-form";
import { EntityLoadingState } from "@/components/shared/entity-loading-state";

export default function NewServicePage() {
  const router = useRouter();
  const { canCreate, isLoading } = usePagePermission("services");

  useEffect(() => {
    if (!isLoading && !canCreate) {
      router.push("/services");
    }
  }, [isLoading, canCreate, router]);

  if (isLoading || !canCreate) {
    return <EntityLoadingState message="Carregando serviço..." />;
  }

  return (
    <FormContainer>
      <FormHeader
        title="Novo Serviço"
        subtitle="Adicione um novo serviço ao seu catálogo"
        icon={Wrench}
        onBack={() => router.push("/services")}
      />
      <ServiceForm />
    </FormContainer>
  );
}
