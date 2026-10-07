"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
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
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePermission } from "@/hooks/usePermission";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "@/lib/toast";
import { buildPortalMessage } from "@/lib/send-link";
import { EXAMPLE_PORTAL_TOKEN } from "@/lib/client-portal/example";
import { formatDateTimeBR } from "@/utils/date-format";
import { ClientPortalService, type ClientPortalLink } from "@/services/client-portal-service";

interface ClientPortalButtonProps {
  client: { id: string; name: string; phone?: string | null; email?: string | null };
}

type Pending = "create" | "rotate" | "revoke" | null;

/**
 * O portal do cliente a partir da ficha do contato: criar o link, mandar pelo
 * WhatsApp ou e-mail da empresa, gerar um novo (o anterior para de abrir) ou
 * desligar. Só para quem edita Contatos e vê Propostas ou Lançamentos (o
 * portal abre as propostas e os pagamentos do contato, e o backend cobra o
 * mesmo); a demonstração abre o exemplo.
 */
export function ClientPortalButton({ client }: ClientPortalButtonProps) {
  const { hasClientPortal } = usePlanLimits();
  // "Portal do cliente" (ação fina de Contatos; ausente, vale o Editar).
  const canEdit = usePermission("clients", "portal");
  const proposals = usePagePermission("proposals");
  const transactions = usePagePermission("transactions");
  const seesPortalContent = proposals.canView || transactions.canView;
  const { isDemo } = usePermissions();
  const { tenant } = useTenant();
  const [open, setOpen] = React.useState(false);
  const [link, setLink] = React.useState<ClientPortalLink | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState<Pending>(null);
  const [confirm, setConfirm] = React.useState<"rotate" | "revoke" | null>(null);

  React.useEffect(() => {
    if (!open || isDemo) return;
    let cancelled = false;
    setLoading(true);
    ClientPortalService.getLink(client.id)
      .then((value) => {
        if (!cancelled) setLink(value);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Erro ao carregar o portal.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isDemo, client.id]);

  if (!hasClientPortal || (!(canEdit && seesPortalContent) && !isDemo)) return null;

  const run = async (kind: Exclude<Pending, null>) => {
    setPending(kind);
    try {
      if (kind === "create") setLink(await ClientPortalService.createLink(client.id));
      if (kind === "rotate") {
        setLink(await ClientPortalService.rotateLink(client.id));
        toast.success("Link novo gerado. O anterior não abre mais.");
      }
      if (kind === "revoke") {
        await ClientPortalService.revokeLink(client.id);
        setLink({ url: null, createdAt: null, lastViewedAt: null, viewCount: 0 });
        toast.success("Portal desligado. O link não abre mais.");
      }
      setConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar o portal.");
    } finally {
      setPending(null);
    }
  };

  const message = link?.url
    ? buildPortalMessage({ clientName: client.name, companyName: tenant?.name, url: link.url })
    : null;

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Globe className="mr-2 h-4 w-4" />
        Portal do cliente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Portal do cliente</DialogTitle>
            <DialogDescription>
              Uma página com as propostas, os pagamentos, a obra e as notas fiscais de {client.name}. O link não
              muda e abre sem senha: mande só para o cliente.
            </DialogDescription>
          </DialogHeader>

          {isDemo ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Na conta de demonstração o link não é criado. Veja como o cliente enxerga o portal:
              </p>
              <Button variant="outline" asChild>
                <Link href={`/share/portal/${EXAMPLE_PORTAL_TOKEN}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver o portal de exemplo
                </Link>
              </Button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-6">
              <Loader size="md" />
            </div>
          ) : link?.url && message ? (
            <div className="space-y-4">
              <SendLinkPanel
                url={link.url}
                subject={message.subject}
                defaultMessage={message.message}
                phone={client.phone}
                email={client.email}
              />
              <p className="text-xs text-muted-foreground">
                {link.viewCount > 0 && link.lastViewedAt
                  ? `Aberto ${link.viewCount === 1 ? "1 vez" : `${link.viewCount} vezes`}, a última em ${formatDateTimeBR(link.lastViewedAt)}.`
                  : "O cliente ainda não abriu o portal."}
              </p>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button variant="ghost" size="sm" disabled={pending !== null} onClick={() => setConfirm("revoke")}>
                  Desligar portal
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
                Criar link do portal
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm === "rotate"}
        onOpenChange={(value) => !value && setConfirm(null)}
        title="Gerar um link novo?"
        description="O link atual para de abrir na hora. Use quando ele foi parar com quem não devia; depois, mande o novo ao cliente."
        confirmLabel="Gerar novo link"
        pendingLabel="Gerando..."
        isPending={pending === "rotate"}
        onConfirm={() => run("rotate")}
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={(value) => !value && setConfirm(null)}
        title="Desligar o portal deste cliente?"
        description="O link para de abrir. As propostas e cobranças que você já mandou continuam valendo pelos links delas."
        confirmLabel="Desligar"
        pendingLabel="Desligando..."
        destructive
        isPending={pending === "revoke"}
        onConfirm={() => run("revoke")}
      />
    </>
  );
}
