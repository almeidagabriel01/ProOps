"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { EntityLoadingState } from "@/components/shared/entity-loading-state";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { InvoiceForm } from "./_components/invoice-form";

/**
 * Emissão da NF-e com revisão.
 *
 * Sem parâmetro é a nota avulsa: remessa para conserto, devolução de compra,
 * retorno. Com `?proposal=<id>` é a nota da venda, aberta para conferir e
 * ajustar (IPI, transporte, observação) antes de sair. Antes desta página a
 * nota da proposta saía direto do botão, sem nada editável, e a nota sem
 * venda não tinha caminho nenhum.
 */
export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("proposal") || undefined;
  const { canCreate, isLoading } = usePagePermission("invoices");
  const { hasFiscal, isLoading: isPlanLoading } = usePlanLimits();

  React.useEffect(() => {
    if (!isLoading && !canCreate) router.push("/invoices");
  }, [isLoading, canCreate, router]);

  if (isLoading || isPlanLoading || !canCreate) {
    return <EntityLoadingState message="Carregando a nota..." />;
  }

  if (!hasFiscal) {
    return (
      <UpgradeRequired
        feature="Notas Fiscais"
        description="Emita NF-e e NFS-e direto da proposta aprovada, e notas de remessa e devolução sem venda. Contrate o add-on de Notas Fiscais ou tenha incluído no plano Enterprise."
      />
    );
  }

  return (
    <FormContainer>
      <FormHeader
        title={proposalId ? "Revisar a nota da venda" : "Nova nota de produto"}
        subtitle={
          proposalId
            ? "Confira o que vai sair e ajuste o que a proposta não sabe: IPI, transporte e observações."
            : "Remessa para conserto, devolução de compra, retorno e outras notas sem venda."
        }
        icon={FileText}
        onBack={() => router.back()}
      />
      <InvoiceForm proposalId={proposalId} />
    </FormContainer>
  );
}
