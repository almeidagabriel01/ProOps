"use client";

import * as React from "react";
import Link from "next/link";
import { Calculator, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import { SendLinkPanel } from "@/components/shared/send-link-panel";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "@/lib/toast";
import { buildAccountantMessage } from "@/lib/send-link";
import { EXAMPLE_ACCOUNTANT_TOKEN } from "@/lib/accountant/example";
import { formatDateTimeBR } from "@/utils/date-format";
import { AccountantService, type AccountantLink } from "@/services/accountant-service";

type Pending = "create" | "rotate" | "revoke" | null;

/**
 * O link do contador, a partir do DRE: leitura, sem login, do DRE, dos
 * lançamentos e das notas, mês a mês. Só dono e administradores geram; a
 * demonstração abre o exemplo.
 */
export function AccountantLinkButton() {
  const { isMaster, isDemo } = usePermissions();
  const { tenant } = useTenant();
  const [open, setOpen] = React.useState(false);
  const [link, setLink] = React.useState<AccountantLink | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState<Pending>(null);
  const [confirm, setConfirm] = React.useState<"rotate" | "revoke" | null>(null);

  React.useEffect(() => {
    if (!open || isDemo) return;
    let cancelled = false;
    setLoading(true);
    AccountantService.getLink()
      .then((value) => {
        if (!cancelled) setLink(value);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Erro ao carregar o link.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isDemo]);

  if (!isMaster && !isDemo) return null;

  const run = async (kind: Exclude<Pending, null>) => {
    setPending(kind);
    try {
      if (kind === "create") setLink(await AccountantService.createLink());
      if (kind === "rotate") {
        setLink(await AccountantService.rotateLink());
        toast.success("Link novo gerado. O anterior não abre mais.");
      }
      if (kind === "revoke") {
        await AccountantService.revokeLink();
        setLink({ url: null, createdAt: null, lastViewedAt: null, viewCount: 0 });
        toast.success("Link desligado. Ele não abre mais.");
      }
      setConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar o link.");
    } finally {
      setPending(null);
    }
  };

  const message = link?.url ? buildAccountantMessage({ companyName: tenant?.name, url: link.url }) : null;

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Calculator className="mr-2 h-4 w-4" />
        Link do contador
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link do contador</DialogTitle>
            <DialogDescription>
              O contador abre o DRE, os lançamentos e as notas fiscais, mês a mês, e exporta para o Excel. É só leitura,
              sem senha e sem contar como usuário. Mande só para ele.
            </DialogDescription>
          </DialogHeader>

          {isDemo ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Na conta de demonstração o link não é criado. Veja o que o contador enxerga:
              </p>
              <Button variant="outline" asChild>
                <Link href={`/share/contador/${EXAMPLE_ACCOUNTANT_TOKEN}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver o exemplo
                </Link>
              </Button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-6">
              <Loader size="md" />
            </div>
          ) : link?.url && message ? (
            <div className="space-y-4">
              <SendLinkPanel url={link.url} subject={message.subject} defaultMessage={message.message} />
              <p className="text-xs text-muted-foreground">
                {link.viewCount > 0 && link.lastViewedAt
                  ? `Aberto ${link.viewCount === 1 ? "1 vez" : `${link.viewCount} vezes`}, a última em ${formatDateTimeBR(link.lastViewedAt)}.`
                  : "O contador ainda não abriu o link."}
              </p>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button variant="ghost" size="sm" disabled={pending !== null} onClick={() => setConfirm("revoke")}>
                  Desligar link
                </Button>
                <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => setConfirm("rotate")}>
                  Gerar novo link
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button disabled={pending !== null} onClick={() => void run("create")}>
                {pending === "create" && <Loader size="sm" variant="button" className="mr-2" />}
                Criar link do contador
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm === "rotate"}
        onOpenChange={(value) => !value && setConfirm(null)}
        title="Gerar um link novo?"
        description="O link atual para de abrir na hora. Use quando trocar de contador ou quando o link foi parar com quem não devia; depois, mande o novo."
        confirmLabel="Gerar novo link"
        pendingLabel="Gerando..."
        isPending={pending === "rotate"}
        onConfirm={() => run("rotate")}
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={(value) => !value && setConfirm(null)}
        title="Desligar o link do contador?"
        description="O link para de abrir. Você pode criar outro quando quiser."
        confirmLabel="Desligar"
        pendingLabel="Desligando..."
        destructive
        isPending={pending === "revoke"}
        onConfirm={() => run("revoke")}
      />
    </>
  );
}
