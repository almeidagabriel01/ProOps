"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, MessageCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/observability/client-error-reporter";
import {
  SUPPORT_WHATSAPP_DIGITS,
  buildWhatsAppHref,
} from "@/lib/whatsapp-contacts";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Como a tela é chamada na frase, ex.: "as propostas". */
  moduleName?: string;
}

/**
 * Erro de uma tela, mostrado no lugar do conteúdo dela pelo `error.tsx` da
 * rota. O menu e o resto do ERP continuam de pé: antes só existia o
 * `error.tsx` da raiz, e um erro em qualquer módulo derrubava a área inteira.
 *
 * O erro vai para o pipeline de observabilidade: o boundary do Next captura
 * antes de chegar ao `window`, então o reporter global não o veria.
 */
export function RouteError({ error, reset, moduleName }: RouteErrorProps) {
  React.useEffect(() => {
    reportClientError(error, {
      route: typeof window === "undefined" ? undefined : window.location.pathname,
    });
  }, [error]);

  const supportHref = buildWhatsAppHref(
    SUPPORT_WHATSAPP_DIGITS,
    `Olá! Tive um erro ao abrir ${moduleName ?? "uma tela"} na ProOps.${
      error.digest ? ` Código: ${error.digest}` : ""
    }`,
  );

  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-5 p-6 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-xl font-semibold">
          {moduleName
            ? `Não foi possível abrir ${moduleName}`
            : "Algo deu errado"}
        </h2>
        <p className="text-sm text-muted-foreground">
          O resto da plataforma continua funcionando. Tente de novo; se o erro
          continuar, fale com o suporte.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/70">
            Código: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Ir para o início</Link>
        </Button>
        <Button variant="ghost" asChild>
          <a href={supportHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" />
            Falar com o suporte
          </a>
        </Button>
      </div>
    </div>
  );
}
