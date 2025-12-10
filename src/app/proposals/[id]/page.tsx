"use client"

import { useParams } from "next/navigation"
import { SimpleProposalForm } from "@/components/features/proposal/simple-proposal-form"

export default function EditProposalPage() {
    const params = useParams()
    const proposalId = params.id as string

    return <SimpleProposalForm proposalId={proposalId} />
}
