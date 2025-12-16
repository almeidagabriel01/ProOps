"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Loader2 } from "lucide-react";
import { SimpleProposalForm } from "@/components/features/proposal/simple-proposal-form"

export default function NewProposalPage() {
    const router = useRouter();
    const { canCreate, isLoading } = usePagePermission("proposals");

    useEffect(() => {
        if (!isLoading && !canCreate) {
            router.push("/proposals");
        }
    }, [isLoading, canCreate, router]);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    }
    return <SimpleProposalForm />
}
