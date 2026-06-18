export interface DemoBookingEmailData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  dateLabel: string; // ex.: "sexta-feira, 19 de junho de 2026"
  timeLabel: string; // ex.: "10:00–11:00"
  durationLabel: string; // ex.: "1 hora"
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function row(label: string, value: string, first = false): string {
  const border = first
    ? ""
    : "border-top:1px solid #e4e4e7;padding-top:16px;";
  return `<tr><td style="padding:0 0 16px;${border}">
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">${label}</p>
    <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">${value}</p>
  </td></tr>`;
}

function shell(title: string, heading: string, rowsHtml: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="background:#18181b;padding:24px 40px;"><h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ProOps</h1></td></tr>
      <tr><td style="padding:40px;">
        <h2 style="margin:0 0 24px;font-size:22px;color:#18181b;font-weight:700;">${heading}</h2>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;border-radius:8px;padding:24px;margin-bottom:24px;"><tr><td>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #e4e4e7;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">${footer}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function renderDemoBookingInternalEmail(
  data: DemoBookingEmailData,
): { subject: string; html: string } {
  const subject = `[ProOps] Nova reunião agendada: ${data.name} — ${data.dateLabel} ${data.timeLabel}`;
  const rows =
    row("Nome", escapeHtml(data.name), true) +
    row("Email", escapeHtml(data.email)) +
    row("Telefone", data.phone ? escapeHtml(data.phone) : "Não informado") +
    row("Empresa", data.company ? escapeHtml(data.company) : "Não informada") +
    row("Dia", escapeHtml(data.dateLabel)) +
    row("Horário", escapeHtml(data.timeLabel)) +
    row("Duração", escapeHtml(data.durationLabel)) +
    row("Mensagem", data.message ? escapeHtml(data.message) : "—");
  const html = shell(
    "Nova reunião agendada — ProOps",
    "Nova reunião agendada",
    rows,
    "Agendamento recebido pela página /agendar da ProOps.<br/>ProOps · gestao@proops.com.br",
  );
  return { subject, html };
}

export function renderDemoBookingConfirmationEmail(
  data: DemoBookingEmailData,
): { subject: string; html: string } {
  const subject = `Sua reunião com a ProOps — ${data.dateLabel}, ${data.timeLabel}`;
  const rows =
    row("Dia", escapeHtml(data.dateLabel), true) +
    row("Horário", escapeHtml(data.timeLabel)) +
    row("Duração", escapeHtml(data.durationLabel));
  const html = shell(
    "Reunião confirmada — ProOps",
    `Tudo certo, ${escapeHtml(data.name.split(" ")[0])}!`,
    rows,
    "Sua reunião com a ProOps está confirmada. Se precisar remarcar, responda este email.<br/>ProOps · gestao@proops.com.br",
  );
  return { subject, html };
}
