"use client";

import { Loader } from "@/components/ui/loader";

interface FullPageLoadingProps {
    message?: string;
    description?: string;
}

export function FullPageLoading({
    message = "Carregando...",
    description
}: FullPageLoadingProps) {
    return <Loader variant="page" label={description ?? message} />;
}
