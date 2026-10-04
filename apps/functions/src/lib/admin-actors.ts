import { db } from "../init";
import { logger } from "./logger";

/**
 * Quem agiu, resolvido a partir do `uid` do evento.
 *
 * Sem isso a tela de auditoria nao distingue uma acao do super admin dentro do
 * painel de uma empresa de uma acao do proprio usuario dela: as duas ficam com
 * o mesmo tenantId. O papel vem do doc do usuario, entao "super admin" e um
 * fato, nao um palpite pelo tipo do evento.
 */
export async function withActors(
  events: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const uids = [
    ...new Set(
      events
        .map((e) => String(e.uid || "").trim())
        .filter(Boolean),
    ),
  ];
  if (uids.length === 0) return events;

  const actors = new Map<string, Record<string, unknown>>();
  try {
    const snaps = await db.getAll(
      ...uids.map((id) => db.collection("users").doc(id)),
    );
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const role = String(snap.get("role") || "").trim();
      actors.set(snap.id, {
        uid: snap.id,
        name: String(snap.get("name") || snap.get("displayName") || ""),
        email: String(snap.get("email") || ""),
        role,
        isSuperAdmin: role.toLowerCase() === "superadmin",
      });
    }
  } catch (err) {
    // Sem o nome de quem agiu a auditoria ainda serve; o uid continua no evento.
    logger.warn("[withActors] actor lookup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return events;
  }

  return events.map((event) => {
    const actor = actors.get(String(event.uid || ""));
    return actor ? { ...event, actor } : event;
  });
}
