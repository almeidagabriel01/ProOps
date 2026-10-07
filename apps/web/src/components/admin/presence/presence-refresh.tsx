"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { formatPresenceTime } from "@/lib/presence-format";

interface PresenceRefreshProps {
  /** Hora da última consulta (`PresenceSnapshot.now`). */
  updatedAt?: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  className?: string;
}

/**
 * "Presença atualizada às 17:20" e o botão para atualizar na hora. A presença
 * já se atualiza sozinha a cada 30 segundos (`useOnlinePresence`); o botão é
 * para quem não quer esperar.
 */
export function PresenceRefresh({ updatedAt, isLoading, onRefresh, className }: PresenceRefreshProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {updatedAt && <span>Presença atualizada às {formatPresenceTime(updatedAt)}</span>}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
        className="h-8 px-2"
        title="Atualizar quem está online"
        aria-label="Atualizar quem está online"
      >
        {isLoading ? <Loader size="sm" variant="button" /> : <RefreshCw className="h-4 w-4" />}
      </Button>
    </div>
  );
}
