"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Service, ServiceService } from "@/services/service-service";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Loader2, Wrench, AlertCircle } from "lucide-react";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { ServiceForm } from "../_components/service-form";

export default function EditServicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const {
    canEdit,
    canView,
    isLoading: permLoading,
  } = usePagePermission("services");

  useEffect(() => {
    if (!permLoading && !canView) {
      router.push("/services");
    }
  }, [permLoading, canView, router]);

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadService = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await ServiceService.getServiceById(id);
        if (data) {
          setService(data);
        } else {
          setError("Serviço não encontrado.");
        }
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar serviço.");
      } finally {
        setLoading(false);
      }
    };
    loadService();
  }, [id]);

  if (loading || permLoading || !canView) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Carregando serviços...
          </p>
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {error || "Serviço não encontrado"}
            </h2>
            <p className="text-muted-foreground text-sm">
              O serviço solicitado não existe ou foi removido.
            </p>
          </div>
          <button
            onClick={() => router.push("/services")}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Voltar para Serviços
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormContainer>
      <FormHeader
        title={canEdit ? "Editar Serviço" : "Visualizar Serviço"}
        subtitle={
          canEdit
            ? `Atualize as informações de "${service.name}"`
            : `Detalhes do serviço "${service.name}"`
        }
        icon={Wrench}
        onBack={() => router.push("/services")}
      />
      <ServiceForm initialData={service} serviceId={id} isReadOnly={!canEdit} />
    </FormContainer>
  );
}
