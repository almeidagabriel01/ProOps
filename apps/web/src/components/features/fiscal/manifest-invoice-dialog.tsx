"use client";

import * as React from "react";
import { Check, Eye, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MANIFESTATION_JUSTIFICATION_MAX_LENGTH,
  MANIFESTATION_JUSTIFICATION_MIN_LENGTH,
  ReceivedInvoiceService,
  requiresJustification,
  type ManifestationType,
  type ReceivedInvoice,
} from "@/services/received-invoice-service";

/**
 * Manifestação do destinatário — declaração formal perante a Receita.
 *
 * Cada opção descreve a **consequência**, não o termo técnico: quem instala
 * automação não sabe o que "ciência da operação" significa, mas sabe responder
 * se comprou ou não. E errar aqui não é um clique desfeito — desconhecer uma
 * nota legítima é declarar à Receita que a operação não é sua.
 *
 * Por isso nada vem pré-selecionado e nada acontece sem escolha explícita,
 * mesmo custando mais passos que um menu de ação rápida.
 */

interface OpcaoManifestacao {
  tipo: ManifestationType;
  titulo: string;
  descricao: string;
  icon: typeof Check;
  destaque?: "positivo" | "negativo";
}

const OPCOES: OpcaoManifestacao[] = [
  {
    tipo: "confirmacao",
    titulo: "Confirmo a compra",
    descricao:
      "A operação aconteceu. Libera o detalhamento da nota, com os produtos e o NCM de cada um.",
    icon: Check,
    destaque: "positivo",
  },
  {
    tipo: "ciencia",
    titulo: "Só dar ciência por enquanto",
    descricao:
      "Registra que você viu a nota, sem afirmar que a compra procede. Dá tempo de conferir antes de confirmar.",
    icon: Eye,
  },
  {
    tipo: "nao_realizada",
    titulo: "A compra foi cancelada",
    descricao:
      "Você reconhece a negociação, mas ela não se concretizou — devolução ou desistência.",
    icon: HelpCircle,
  },
  {
    tipo: "desconhecimento",
    titulo: "Não reconheço esta nota",
    descricao:
      "Você nunca comprou desse fornecedor. Use quando a nota foi emitida contra o seu CNPJ por engano ou fraude.",
    icon: X,
    destaque: "negativo",
  },
];

function formatarValor(valor: number | undefined): string {
  if (typeof valor !== "number") return "";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ManifestInvoiceDialogProps {
  invoice: ReceivedInvoice | null;
  onClose: () => void;
  onManifested: (invoice: ReceivedInvoice) => void;
}

export function ManifestInvoiceDialog({
  invoice,
  onClose,
  onManifested,
}: ManifestInvoiceDialogProps) {
  const [tipo, setTipo] = React.useState<ManifestationType | null>(null);
  const [justificativa, setJustificativa] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  // Abrir para outra nota não pode herdar a escolha da anterior — seria o
  // caminho mais curto para manifestar a nota errada.
  React.useEffect(() => {
    if (invoice) {
      setTipo(null);
      setJustificativa("");
    }
  }, [invoice]);

  const precisaJustificar = tipo !== null && requiresJustification(tipo);
  const tamanhoJustificativa = justificativa.trim().length;
  const justificativaValida =
    !precisaJustificar ||
    (tamanhoJustificativa >= MANIFESTATION_JUSTIFICATION_MIN_LENGTH &&
      tamanhoJustificativa <= MANIFESTATION_JUSTIFICATION_MAX_LENGTH);

  async function handleConfirm() {
    if (!invoice || !tipo || !justificativaValida) return;
    setIsSaving(true);
    try {
      const updated = await ReceivedInvoiceService.manifest(
        invoice.chaveAcesso,
        tipo,
        precisaJustificar ? justificativa.trim() : undefined,
      );
      onManifested(updated);
      toast.success("Resposta registrada.", {
        description:
          tipo === "confirmacao"
            ? "O detalhamento da nota chega em instantes."
            : "A Receita foi notificada da sua resposta.",
      });
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível registrar a resposta.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const emitente = invoice?.emitenteNome || invoice?.emitenteCnpj || "";
  const valor = formatarValor(invoice?.valorTotal);

  return (
    <Dialog
      open={invoice !== null}
      onOpenChange={(open) => !open && !isSaving && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Responder sobre esta nota</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-sm">
              <p>
                <strong className="text-foreground">{emitente}</strong>
                {invoice?.numero ? ` · nota ${invoice.numero}` : ""}
                {valor ? ` · ${valor}` : ""}
              </p>
              <p>
                Sua resposta fica registrada na Receita Federal e não pode ser
                desfeita.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
          {OPCOES.map((opcao) => {
            const Icon = opcao.icon;
            const selecionada = tipo === opcao.tipo;
            return (
              <button
                key={opcao.tipo}
                type="button"
                onClick={() => setTipo(opcao.tipo)}
                disabled={isSaving}
                aria-pressed={selecionada}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  selecionada ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    opcao.destaque === "positivo" && "text-emerald-600",
                    opcao.destaque === "negativo" && "text-destructive",
                  )}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{opcao.titulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {opcao.descricao}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {precisaJustificar && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manifest-justificativa">
              Por que a compra não se concretizou?
            </Label>
            <Textarea
              id="manifest-justificativa"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              maxLength={MANIFESTATION_JUSTIFICATION_MAX_LENGTH}
              rows={3}
              placeholder="Ex.: mercadoria devolvida por avaria na entrega"
            />
            {/* O mínimo é exigência da SEFAZ, não nossa. Dizê-lo antes evita
                escrever pouco e descobrir só na recusa. */}
            <p className="text-xs text-muted-foreground">
              {tamanhoJustificativa} de {MANIFESTATION_JUSTIFICATION_MAX_LENGTH}{" "}
              caracteres — mínimo de {MANIFESTATION_JUSTIFICATION_MIN_LENGTH}.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!tipo || !justificativaValida || isSaving}
          >
            {isSaving && <Loader size="sm" variant="button" className="mr-2" />}
            Registrar resposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
