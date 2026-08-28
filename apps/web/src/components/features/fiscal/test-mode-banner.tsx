"use client";

import * as React from "react";
import { FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import {
  FiscalService,
  type FiscalSettings,
} from "@/services/fiscal-service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Aviso de modo de teste, na tela de notas.
 *
 * Fica aqui e não em Configurações de propósito — é o padrão do Bling, e o
 * motivo é bom: esta é a tela onde a pessoa olha as notas que emitiu, e é onde
 * "isso não vale nada ainda" precisa estar visível. Enterrado num formulário de
 * configuração, o cliente esquece que está emitindo nota sem valor fiscal.
 *
 * O texto também não fala "homologação". Para quem instala automação, isso não
 * significa nada; "modo de teste" significa.
 */

interface TestModeBannerProps {
  settings: FiscalSettings | null;
  onChanged: (settings: FiscalSettings) => void;
}

export function TestModeBanner({ settings, onChanged }: TestModeBannerProps) {
  const [isSwitching, setIsSwitching] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [needsForce, setNeedsForce] = React.useState(false);

  if (!settings || settings.environment === "producao") {
    return null;
  }

  const isReady = settings.status === "ready";

  async function activate(force: boolean) {
    setIsSwitching(true);
    try {
      const updated = await FiscalService.setEnvironment("producao", force);
      onChanged(updated);
      setConfirmOpen(false);
      setNeedsForce(false);
      toast.success("Emissão real ativada.", {
        description: "As próximas notas terão valor fiscal.",
      });
    } catch (error) {
      // O gate é o único erro que vira uma escolha em vez de uma falha.
      const code =
        error instanceof ApiError
          ? (error.data as { code?: string } | undefined)?.code
          : undefined;
      if (code === "FISCAL_SEM_NOTA_DE_TESTE") {
        setNeedsForce(true);
        setConfirmOpen(true);
        return;
      }
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível ativar a emissão real.",
      );
    } finally {
      setIsSwitching(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium">Modo de teste</p>
            <p className="text-sm text-muted-foreground">
              As notas abaixo <strong>não têm valor fiscal</strong>. Servem para
              conferir os dados antes de começar a emitir de verdade.
            </p>
          </div>
        </div>
        <Button
          onClick={() => (isReady ? setConfirmOpen(true) : void activate(false))}
          disabled={isSwitching}
        >
          {isSwitching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          Ativar emissão real
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {needsForce
                ? "Nenhuma nota de teste foi autorizada ainda"
                : "Ativar emissão real?"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm">
                {needsForce ? (
                  <>
                    <p>
                      Uma nota de teste autorizada é o que prova que a empresa está
                      credenciada na prefeitura ou na SEFAZ. Sem ela, a primeira
                      nota real pode falhar — e falhar na frente do cliente.
                    </p>
                    <p>
                      Se a empresa <strong>já emite nota hoje</strong> por outro
                      sistema, esse credenciamento existe e você pode seguir.
                    </p>
                  </>
                ) : (
                  <p>
                    A partir de agora cada nota emitida vale juridicamente, consome
                    numeração e gera imposto. Cancelar depois tem prazo e regras
                    próprias.
                  </p>
                )}
                <p>Dá para voltar ao modo de teste a qualquer momento.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void activate(needsForce)} disabled={isSwitching}>
              {isSwitching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {needsForce ? "Ativar mesmo assim" : "Ativar emissão real"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
