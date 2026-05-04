"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePagePermission } from "@/hooks/usePagePermission";
;
import { SimpleProposalForm } from "@/components/features/proposal/simple-proposal-form"
import { EntityLoadingState } from "@/components/shared/entity-loading-state";

export default function NewProposalPage() {
    const router = useRouter();
    const { canCreate, isLoading } = usePagePermission("proposals");

    useEffect(() => {
        if (!isLoading && !canCreate) {
            router.push("/proposals");
        }
    }, [isLoading, canCreate, router]);

    // Show loading while checking permissions OR while redirecting (no permission)
    if (isLoading || !canCreate) {
        return <EntityLoadingState message="Carregando Proposta..." />;
    }
    return <SimpleProposalForm />
}
