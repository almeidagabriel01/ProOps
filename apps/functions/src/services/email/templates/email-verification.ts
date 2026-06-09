export interface EmailVerificationEmailData {
  email: string;
  verifyUrl: string;
}

export interface EmailVerificationEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function renderEmailVerificationEmail(
  data: EmailVerificationEmailData,
): EmailVerificationEmailContent {
  const subject = "Confirme seu email — ProOps";

  const text = `Confirme seu email — ProOps

Olá, recebemos seu cadastro na ProOps. Para ativar sua conta, confirme seu endereço de email abrindo o link abaixo no seu navegador:

${data.verifyUrl}

Este link expira em 24 horas. Se você não criou esta conta, ignore este email.

ProOps — Sistema ERP para gestão de serviços
gestao@proops.com.br
`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirme seu email — ProOps</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#18181b;padding:24px 40px;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ProOps</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#18181b;font-weight:700;">Confirme seu email</h2>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
                Olá, recebemos seu cadastro na ProOps. Para ativar sua conta, confirme seu endereço de email.
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#3f3f46;line-height:1.6;">
                Clique no botão abaixo. O link expira em 24 horas.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:0 0 32px;">
                    <a href="${escapeAttr(data.verifyUrl)}"
                       style="display:inline-block;background:#18181b;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
                      Confirmar email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.6;">
                Se o botão não funcionar, copie e cole este endereço no navegador:
              </p>
              <p style="margin:0 0 24px;font-size:13px;color:#3f3f46;line-height:1.6;word-break:break-all;">
                <a href="${escapeAttr(data.verifyUrl)}" style="color:#3f3f46;text-decoration:underline;">${escapeHtml(data.verifyUrl)}</a>
              </p>
              <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
                Se você não criou esta conta, pode ignorar este email com segurança.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Este email foi enviado para ${escapeHtml(data.email)}.<br/>
                ProOps · Sistema ERP para gestão de serviços<br/>
                Precisa de ajuda? Responda este email ou escreva para gestao@proops.com.br
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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

function escapeAttr(str: string): string {
  return escapeHtml(str);
}
