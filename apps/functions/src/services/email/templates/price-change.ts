export interface PriceChangeEmailProps {
  tenantName: string;
  planName: string;
  oldPriceFormatted: string;
  newPriceFormatted: string;
  renewalDateFormatted: string;
  cancelUrl: string;
}

export function renderPriceChangeEmail(props: PriceChangeEmailProps): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atualização de preço do ProOps</title>
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
              <h2 style="margin:0 0 8px;font-size:22px;color:#18181b;font-weight:700;">Atualização de preço do ${escapeHtml(props.planName)}</h2>
              <p style="margin:0 0 24px;font-size:15px;color:#71717a;">Olá, ${escapeHtml(props.tenantName)}</p>

              <p style="font-size:15px;color:#3f3f46;line-height:1.6;margin:0 0 24px;">
                Informamos que o preço do seu <strong>${escapeHtml(props.planName)}</strong> será atualizado a partir da próxima renovação.
              </p>

              <!-- Price box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;border-radius:8px;padding:24px;margin-bottom:24px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Preço atual</p>
                    <p style="margin:0 0 16px;font-size:24px;font-weight:700;color:#3f3f46;text-decoration:line-through;">${escapeHtml(props.oldPriceFormatted)}<span style="font-size:14px;font-weight:400;">/mês</span></p>
                    <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Novo preço (a partir de ${escapeHtml(props.renewalDateFormatted)})</p>
                    <p style="margin:0;font-size:24px;font-weight:700;color:#18181b;">${escapeHtml(props.newPriceFormatted)}<span style="font-size:14px;font-weight:400;">/mês</span></p>
                  </td>
                </tr>
              </table>

              <p style="font-size:15px;color:#3f3f46;line-height:1.6;margin:0 0 24px;">
                Você tem <strong>30 dias</strong> para decidir. Caso prefira não continuar com o novo preço, basta cancelar sua assinatura antes de <strong>${escapeHtml(props.renewalDateFormatted)}</strong>.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#ef4444;border-radius:6px;">
                    <a href="${escapeHtml(props.cancelUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Cancelar minha assinatura</a>
                  </td>
                </tr>
              </table>

              <p style="font-size:13px;color:#a1a1aa;line-height:1.6;margin:0;">
                Se você optar por manter sua assinatura, nenhuma ação é necessária — o novo preço será aplicado automaticamente na renovação.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Você está recebendo este email porque possui uma assinatura ativa no ProOps.<br/>
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
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
