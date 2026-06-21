import { logger } from "../../lib/logger";

/**
 * Cria uma reunião Zoom agendada para a demonstração da landing (/agendar) via
 * Server-to-Server OAuth. Best-effort: se as credenciais não estiverem
 * configuradas OU a API falhar, retorna `null` e o chamador usa um fallback
 * (Jitsi) — o agendamento nunca quebra por causa do Zoom.
 *
 * Credenciais (apps/functions/.env.*): ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID,
 * ZOOM_CLIENT_SECRET — de um app "Server-to-Server OAuth" no Zoom Marketplace
 * com o escopo `meeting:write:admin` (ou `meeting:write`).
 */

const SAO_PAULO_TZ = "America/Sao_Paulo";

export interface CreateZoomMeetingInput {
  topic: string;
  date: string; // YYYY-MM-DD (BRT)
  startMinutes: number; // minutos desde meia-noite (BRT)
  durationMinutes: number;
}

async function getZoomAccessToken(): Promise<string | null> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } },
  );
  if (!res.ok) {
    logger.error("zoom token request failed", { status: res.status });
    return null;
  }
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function createZoomMeeting(
  input: CreateZoomMeetingInput,
): Promise<string | null> {
  try {
    const token = await getZoomAccessToken();
    if (!token) return null;

    const h = Math.floor(input.startMinutes / 60);
    const m = input.startMinutes % 60;
    // Sem offset 'Z': o Zoom interpreta start_time no `timezone` informado.
    const startTime = `${input.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

    const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: input.topic.slice(0, 200),
        type: 2, // reunião agendada
        start_time: startTime,
        duration: input.durationMinutes,
        timezone: SAO_PAULO_TZ,
        settings: {
          join_before_host: true,
          waiting_room: false,
          approval_type: 2, // sem registro
        },
      }),
    });

    if (!res.ok) {
      logger.error("zoom create meeting failed", { status: res.status });
      return null;
    }
    const data = (await res.json()) as { join_url?: string };
    return data.join_url ?? null;
  } catch (err) {
    logger.error("zoom create meeting error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
