"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";
import { EXAMPLE_PORTAL, EXAMPLE_PORTAL_TOKEN } from "@/lib/client-portal/example";
import { ClientPortalService, type PortalItemKind, type PortalView } from "@/services/client-portal-service";
import { ClientPortalView } from "./client-portal-view";

interface PublicClientPortalProps {
  token: string;
  /** Troca de página; injetável para teste. */
  navigate?: (url: string) => void;
}

/**
 * Carrega o portal pelo token. O token `exemplo` mostra o portal fictício da
 * demonstração, sem API.
 */
export function PublicClientPortal({ token, navigate }: PublicClientPortalProps) {
  const isExample = token === EXAMPLE_PORTAL_TOKEN;
  const [view, setView] = React.useState<PortalView | null>(isExample ? EXAMPLE_PORTAL : null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!isExample);

  React.useEffect(() => {
    if (isExample) return;
    let cancelled = false;
    ClientPortalService.publicView(token)
      .then((next) => {
        if (!cancelled) setView(next);
      })
      .catch(() => {
        if (!cancelled) setError("Este link não está disponível. Peça um novo à empresa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isExample, token]);

  const onOpen = React.useCallback(
    async (kind: PortalItemKind, id: string) => {
      if (isExample) {
        toast.info("No exemplo os itens não abrem. No portal de verdade, cada um leva à página dele.");
        return;
      }
      try {
        const url = await ClientPortalService.openItem(token, kind, id);
        (navigate ?? ((next: string) => window.location.assign(next)))(url);
      } catch {
        toast.error("Não foi possível abrir agora. Tente de novo em instantes.");
      }
    },
    [isExample, navigate, token],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Link indisponível</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return <ClientPortalView view={view} onOpen={onOpen} example={isExample} />;
}
