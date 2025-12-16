"use client"

import { useParams } from "next/navigation"
import { SimpleProposalForm } from "@/components/features/proposal/simple-proposal-form"
import { usePagePermission } from "@/hooks/usePagePermission";

export default function EditProposalPage() {
    const params = useParams()
    const proposalId = params.id as string
    const { canEdit } = usePagePermission("proposals");

    return <SimpleProposalForm proposalId={proposalId} isReadOnly={!canEdit} />
}
