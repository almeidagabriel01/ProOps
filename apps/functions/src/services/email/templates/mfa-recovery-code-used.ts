export interface RecoveryCodeUsedEmailData {
  name?: string;
}

export interface RecoveryCodeUsedEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function renderRecoveryCodeUsedEmail(
  data: RecoveryCodeUsedEmailData,
): RecoveryCodeUsedEmailContent {
  const subject = "Um código de recuperação foi usado — ProOps";
  const greetingName = data.name ? data.name.trim() : "";
  const greeting = greetingName ? `Olá, ${greetingName}` : "Olá";

  const text = `Um código de recuperação foi usado — ProOps

${greeting}, um código de recuperação foi usado para entrar na sua conta na ProOps.

A verificação em dois fatores da sua conta continua ativa. Você usou um código de recuperação como alternativa de uso único ao desafio do aplicativo autenticador.

Se foi você, nenhuma ação é necessária. Recomendamos revisar seus códigos de recuperação e reconfigurar o aplicativo autenticador no seu perfil se você perdeu o acesso a ele.

Se você NÃO reconhece este acesso, sua conta pode estar comprometida. Entre em contato com o suporte imediatamente respondendo este email ou escrevendo para gestao@proops.com.br.

ProOps — Sistema ERP para gestão de serviços
gestao@proops.com.br
`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Um código de recuperação foi usado — ProOps</title>
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
              <h2 style="margin:0 0 16px;font-size:22px;color:#18181b;font-weight:700;">Código de recuperação usado</h2>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
                ${escapeHtml(greeting)}, um código de recuperação foi usado para entrar na sua conta na ProOps.
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
                A verificação em dois fatores da sua conta continua ativa. Você usou um código de recuperação como alternativa de uso único ao desafio do aplicativo autenticador.
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
                Se foi você, nenhuma ação é necessária. Recomendamos revisar seus códigos de recuperação e reconfigurar o aplicativo autenticador no seu perfil se você perdeu o acesso a ele.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#b91c1c;line-height:1.6;font-weight:600;">
                Se você não reconhece este acesso, sua conta pode estar comprometida. Entre em contato com o suporte imediatamente.
              </p>
              <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
                Para falar com o suporte, responda este email ou escreva para gestao@proops.com.br.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
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
