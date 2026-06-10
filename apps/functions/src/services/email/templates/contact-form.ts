export interface ContactFormEmailData {
  name: string;
  company: string;
  email: string;
  phone?: string;
  segment: string;
  message: string;
}

export function renderContactFormEmail(data: ContactFormEmailData): { subject: string; html: string } {
  const subject = `[ProOps] Novo contato: ${data.name} — ${data.company}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Novo contato via formulário — ProOps</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:24px 40px;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ProOps</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 24px;font-size:22px;color:#18181b;font-weight:700;">Novo contato via formulário</h2>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;border-radius:8px;padding:24px;margin-bottom:24px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:0 0 16px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Nome</p>
                          <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">${escapeHtml(data.name)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 16px;border-top:1px solid #e4e4e7;padding-top:16px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Empresa</p>
                          <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">${escapeHtml(data.company)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 16px;border-top:1px solid #e4e4e7;padding-top:16px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Email</p>
                          <p style="margin:0;font-size:15px;color:#18181b;">${escapeHtml(data.email)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 16px;border-top:1px solid #e4e4e7;padding-top:16px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Telefone</p>
                          <p style="margin:0;font-size:15px;color:#18181b;">${data.phone ? escapeHtml(data.phone) : '<span style="color:#a1a1aa;">Não informado</span>'}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 16px;border-top:1px solid #e4e4e7;padding-top:16px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Segmento</p>
                          <p style="margin:0;font-size:15px;color:#18181b;">${escapeHtml(data.segment)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="border-top:1px solid #e4e4e7;padding-top:16px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Mensagem</p>
                          <p style="margin:0;font-size:15px;color:#3f3f46;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Mensagem recebida pelo formulário de contato da ProOps.<br/>
                ProOps · gestao@proops.com.br
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
