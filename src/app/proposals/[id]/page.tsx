"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { SimpleProposalForm } from "@/components/features/proposal/simple-proposal-form"
import { usePagePermission } from "@/hooks/usePagePermission";

export default function EditProposalPage() {
    const params = useParams()
    const proposalId = params.id as string
    const router = useRouter();
    const { canEdit, canView, isLoading } = usePagePermission("proposals");

    useEffect(() => {
        if (!isLoading && !canView) {
            router.push("/proposals");
        }
    }, [isLoading, canView, router]);

    if (isLoading) return null;

    return <SimpleProposalForm proposalId={proposalId} isReadOnly={!canEdit} />
}
