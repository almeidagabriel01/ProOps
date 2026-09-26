"use client";

import * as React from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { buildMailtoHref, buildWhatsAppShareHref } from "@/lib/send-link";

interface SendLinkPanelProps {
  url: string;
  subject: string;
  defaultMessage: string;
  phone?: string | null;
  email?: string | null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.left = "-999999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Enviar um link (proposta, cobrança) pelo WhatsApp ou pelo e-mail da
 * própria empresa: a mensagem vem pronta e editável, e os botões abrem o
 * aplicativo do usuário. Sem o telefone, o WhatsApp deixa escolher o contato.
 */
export function SendLinkPanel({
  url,
  subject,
  defaultMessage,
  phone,
  email,
}: SendLinkPanelProps) {
  const [message, setMessage] = React.useState(defaultMessage);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => setMessage(defaultMessage), [defaultMessage]);

  const handleCopy = async () => {
    if (await copyText(url)) {
      setCopied(true);
      toast.success("Link copiado!");
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.warning("Não foi possível copiar. Selecione o link e copie.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {url}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleCopy()}>
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="send-link-message">Mensagem</Label>
        <Textarea
          id="send-link-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[140px]"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
          <a
            href={buildWhatsAppShareHref(phone, message)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar pelo WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={buildMailtoHref(email, subject, message)}>
            <Mail className="mr-2 h-4 w-4" />
            Enviar por e-mail
          </a>
        </Button>
      </div>
      {!phone && (
        <p className="text-xs text-muted-foreground">
          O contato não tem telefone cadastrado: o WhatsApp abre para você
          escolher a conversa.
        </p>
      )}
    </div>
  );
}
