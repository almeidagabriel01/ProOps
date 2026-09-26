export interface NotificationEmailProps {
  title: string;
  message: string;
  actionUrl: string;
  preferencesUrl: string;
}

/** Aviso por e-mail de uma notificação da central, no mesmo desenho dos outros e-mails. */
export function renderNotificationEmail(props: NotificationEmailProps): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(props.title)} | ProOps</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#18181b;padding:24px 40px;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ProOps</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#18181b;font-weight:700;">${escapeHtml(props.title)}</h2>
              <p style="font-size:15px;color:#3f3f46;line-height:1.6;margin:0 0 32px;">${escapeHtml(props.message)}</p>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#18181b;border-radius:6px;">
                    <a href="${escapeHtml(props.actionUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Abrir na ProOps</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Você recebe este aviso porque ele está ligado nas suas preferências de notificação.
                <a href="${escapeHtml(props.preferencesUrl)}" style="color:#71717a;">Escolher o que chega por e-mail</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderNotificationEmailText(props: NotificationEmailProps): string {
  return `${props.title}\n\n${props.message}\n\nAbrir na ProOps: ${props.actionUrl}\n\nEscolher o que chega por e-mail: ${props.preferencesUrl}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
