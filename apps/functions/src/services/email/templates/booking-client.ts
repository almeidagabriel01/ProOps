export interface BookingClientEmailProps {
  companyName: string;
  clientName: string;
  visitLabel: string;
  /** "sexta-feira, 26/09 às 09:30" */
  when: string;
  outcome: "confirmed" | "declined";
  /** Recado da empresa ao recusar (opcional). */
  message?: string | null;
  /** Link para escolher outro horário, quando o link segue aberto. */
  rebookUrl?: string | null;
}

/**
 * Resposta ao pedido de visita, para o CLIENTE da empresa. É o primeiro e-mail
 * da plataforma que sai para alguém de fora: o remetente continua sendo a
 * ProOps, então o texto diz com todas as letras de qual empresa ele é.
 */
export function renderBookingClientEmail(props: BookingClientEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const confirmed = props.outcome === "confirmed";
  const subject = confirmed
    ? `${props.visitLabel} confirmada: ${props.companyName}`
    : `${props.visitLabel}: ${props.companyName} precisa de outro horário`;
  const lead = confirmed
    ? `A ${props.companyName} confirmou a sua ${props.visitLabel.toLocaleLowerCase("pt-BR")} para ${props.when}.`
    : `A ${props.companyName} não consegue atender no horário pedido (${props.when}).`;
  const message = props.message?.trim() || "";
  const showRebook = !confirmed && Boolean(props.rebookUrl);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#18181b;padding:24px 40px;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">${escapeHtml(props.companyName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:15px;color:#71717a;">Olá, ${escapeHtml(props.clientName)}</p>
              <p style="font-size:15px;color:#3f3f46;line-height:1.6;margin:0 0 24px;">${escapeHtml(lead)}</p>
              ${message ? `<p style="font-size:15px;color:#3f3f46;line-height:1.6;margin:0 0 24px;padding:16px;background:#f4f4f5;border-radius:6px;">${escapeHtml(message)}</p>` : ""}
              ${
                showRebook
                  ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td style="background:#18181b;border-radius:6px;"><a href="${escapeHtml(props.rebookUrl ?? "")}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Escolher outro horário</a></td></tr></table>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Você recebe este e-mail porque pediu um horário à ${escapeHtml(props.companyName)}. Enviado pela ProOps.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Olá, ${props.clientName}`,
    "",
    lead,
    message ? `\n${message}` : "",
    showRebook ? `\nEscolher outro horário: ${props.rebookUrl}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
