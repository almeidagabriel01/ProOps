"use client";

import * as React from "react";
import { CalendarClock, MapPin, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/ui/loader";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { toast } from "@/lib/toast";
import { describeBookingWhen } from "@/lib/booking/booking-format";
import { BookingService, type BookingRequest } from "@/services/booking-service";

interface BookingRequestsButtonProps {
  /** Recarrega a Agenda depois de confirmar ou recusar. */
  onChanged: () => void;
  /** `?pedido=` da notificação: abre a lista já nele. */
  highlightId?: string | null;
}

function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

/**
 * Pedidos de visita que chegaram pelo link de agendamento e esperam resposta.
 * Um botão no cabeçalho da Agenda, e não um painel fixo: a tela tem altura
 * calculada no desktop, e um bloco a mais em cima empurraria o calendário.
 */
export function BookingRequestsButton({ onChanged, highlightId }: BookingRequestsButtonProps) {
  const { hasBookingLink } = usePlanLimits();
  const { canEdit } = usePagePermission("calendar");
  const [requests, setRequests] = React.useState<BookingRequest[]>([]);
  const [open, setOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [declining, setDeclining] = React.useState<BookingRequest | null>(null);
  const [declineMessage, setDeclineMessage] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setRequests(await BookingService.pendingRequests());
    } catch {
      setRequests([]);
    }
  }, []);

  React.useEffect(() => {
    if (!hasBookingLink) return;
    void load();
  }, [hasBookingLink, load]);

  React.useEffect(() => {
    if (highlightId && requests.some((r) => r.id === highlightId)) setOpen(true);
  }, [highlightId, requests]);

  if (!hasBookingLink || requests.length === 0) return null;

  const confirm = async (request: BookingRequest) => {
    setBusyId(request.id);
    try {
      await BookingService.confirmRequest(request.id);
      toast.success(
        request.email ? "Visita confirmada. O cliente recebe a confirmação por e-mail." : "Visita confirmada.",
      );
      setRequests((current) => current.filter((r) => r.id !== request.id));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao confirmar a visita.");
    } finally {
      setBusyId(null);
    }
  };

  const decline = async () => {
    if (!declining) return;
    setBusyId(declining.id);
    try {
      await BookingService.declineRequest(declining.id, declineMessage.trim() || undefined);
      toast.success("Pedido recusado. O horário voltou a ficar livre.");
      setRequests((current) => current.filter((r) => r.id !== declining.id));
      setDeclining(null);
      setDeclineMessage("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao recusar o pedido.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full border-amber-500/40 px-4 text-amber-700 dark:text-amber-400"
        onClick={() => setOpen(true)}
      >
        <CalendarClock className="mr-2 h-4 w-4" />
        Pedidos de visita ({requests.length})
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedidos de visita</DialogTitle>
            <DialogDescription>
              Chegaram pelo link de agendamento. O horário já está reservado na Agenda como
              &quot;a confirmar&quot;.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
            {requests.map((request) => (
              <li
                key={request.id}
                className={`rounded-lg border p-3 ${request.id === highlightId ? "border-primary" : ""}`}
              >
                <p className="text-sm font-semibold">
                  {request.visitTypeLabel}: {request.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {describeBookingWhen(request.date, request.startMin)}
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${request.phone}`} className="hover:underline">
                      {request.phone}
                    </a>
                    <a
                      href={whatsappHref(request.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </p>
                  {request.address && (
                    <p className="flex items-start gap-2 break-words">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {request.address}
                    </p>
                  )}
                  {request.notes && (
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">{request.notes}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId !== null}
                      onClick={() => {
                        setDeclining(request);
                        setDeclineMessage("");
                      }}
                    >
                      Recusar
                    </Button>
                    <Button size="sm" disabled={busyId !== null} onClick={() => void confirm(request)}>
                      {busyId === request.id && <Loader size="sm" variant="button" className="mr-2" />}
                      Confirmar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={declining !== null} onOpenChange={(value) => !value && busyId === null && setDeclining(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar o pedido?</DialogTitle>
            <DialogDescription>
              O horário volta a ficar livre.
              {declining?.email
                ? " O cliente recebe o recado por e-mail, com o link para escolher outro horário."
                : " O cliente não informou e-mail: avise pelo telefone."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Recado para o cliente"
            placeholder="Recado para o cliente (opcional). Ex.: Nesse dia não conseguimos, pode escolher a semana que vem?"
            value={declineMessage}
            onChange={(e) => setDeclineMessage(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeclining(null)} disabled={busyId !== null}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={() => void decline()} disabled={busyId !== null}>
              {busyId === declining?.id && <Loader size="sm" variant="button" className="mr-2" />}
              Recusar pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
