export type InternalLifecycleEvent =
  | "signup"
  | "team_member_added"
  | "new_subscription"
  | "plan_upgrade"
  | "plan_downgrade"
  | "cancel_scheduled"
  | "cancel_rescinded"
  | "subscription_canceled";

export interface InternalLifecycleEmailData {
  event: InternalLifecycleEvent;
  user: { name?: string; email?: string; phone?: string; role?: string };
  tenant: { id: string; company?: string; niche?: string };
  plan?: {
    from?: string;
    to?: string;
    interval?: string;
    effectiveAtLabel?: string;
  };
  isDev?: boolean;
}

interface EventCopy {
  subject: string;
  heading: string;
}

function buildEventCopy(data: InternalLifecycleEmailData): EventCopy {
  const name = data.user.name || "Sem nome";
  const company = data.tenant.company || "Sem empresa";
  const from = data.plan?.from || "?";
  const to = data.plan?.to || "?";

  switch (data.event) {
    case "signup":
      return {
        subject: `[ProOps] Novo cadastro: ${name} — ${company}`,
        heading: "Novo cadastro na plataforma",
      };
    case "team_member_added":
      return {
        subject: `[ProOps] Novo membro de equipe: ${name} — ${company}`,
        heading: "Novo membro de equipe adicionado",
      };
    case "new_subscription":
      return {
        subject: `[ProOps] Nova assinatura: ${company} → ${to}${data.plan?.interval ? ` (${data.plan.interval})` : ""}`,
        heading: "Nova assinatura contratada",
      };
    case "plan_upgrade":
      return {
        subject: `[ProOps] Upgrade de plano: ${company} — ${from} → ${to}`,
        heading: "Upgrade de plano",
      };
    case "plan_downgrade":
      return {
        subject: `[ProOps] Downgrade de plano: ${company} — ${from} → ${to}`,
        heading: "Downgrade de plano",
      };
    case "cancel_scheduled":
      return {
        subject: `[ProOps] Cancelamento agendado: ${company}`,
        heading: "Cancelamento de assinatura agendado",
      };
    case "cancel_rescinded":
      return {
        subject: `[ProOps] Cancelamento revertido: ${company}`,
        heading: "Cancelamento de assinatura revertido",
      };
    case "subscription_canceled":
      return {
        subject: `[ProOps] Assinatura cancelada: ${company} — ${from} → free`,
        heading: "Assinatura cancelada",
      };
  }
}

function row(label: string, value: string | undefined, isFirst = false): string {
  const border = isFirst
    ? ""
    : "border-top:1px solid #e4e4e7;padding-top:16px;";
  const rendered = value
    ? escapeHtml(value)
    : '<span style="color:#a1a1aa;">Não informado</span>';
  return `<tr>
                        <td style="padding:0 0 16px;${border}">
                          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">${label}</p>
                          <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">${rendered}</p>
                        </td>
                      </tr>`;
}

export function renderInternalLifecycleEmail(
  data: InternalLifecycleEmailData,
): { subject: string; html: string } {
  const copy = buildEventCopy(data);
  const subject = data.isDev ? `[DEV] ${copy.subject}` : copy.subject;

  const rows: string[] = [
    row("Nome", data.user.name, true),
    row("Email", data.user.email),
    row("Telefone", data.user.phone),
    row("Empresa", data.tenant.company),
    row("Nicho", data.tenant.niche),
    row("Tenant ID", data.tenant.id),
  ];
  if (data.plan) {
    if (data.plan.from) rows.push(row("Plano anterior", data.plan.from));
    if (data.plan.to) rows.push(row("Plano novo", data.plan.to));
    if (data.plan.interval) rows.push(row("Recorrência", data.plan.interval));
    if (data.plan.effectiveAtLabel) {
      rows.push(row("Efetivo em", data.plan.effectiveAtLabel));
    }
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(copy.heading)} — ProOps</title>
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
              <h2 style="margin:0 0 24px;font-size:22px;color:#18181b;font-weight:700;">${escapeHtml(copy.heading)}</h2>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;border-radius:8px;padding:24px;margin-bottom:24px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${rows.join("\n                      ")}
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
                Notificação interna automática de ciclo de vida (cadastro/plano).<br/>
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
