/**
 * Barra login CSRF no `POST /api/auth/session`.
 *
 * O corpo era lido com `req.json()` sem olhar o `Content-Type`. Um
 * `<form method=POST enctype="text/plain">` de outro site consegue montar um
 * corpo que é JSON válido com o idToken do ATACANTE, e a resposta da navegação
 * aplica o `Set-Cookie`: a vítima passava a navegar logada na conta dele.
 *
 * - `Content-Type: application/json` é o que um formulário não consegue mandar;
 *   um `fetch` de outra origem com esse tipo exige preflight de CORS, que esta
 *   rota não atende. Esta checagem sozinha fecha o vetor.
 * - `Sec-Fetch-Site` é a segunda camada: quando o navegador o manda, só
 *   `same-origin` (e `none`, navegação digitada) passa. O cookie é de host, então
 *   nem um subdomínio da própria ProOps tem motivo para chamar esta rota.
 */
export type SessionRequestVerdict = "ok" | "unsupported-media-type" | "cross-origin";

export function checkSessionRequestOrigin(headers: {
  contentType: string | null;
  secFetchSite: string | null;
}): SessionRequestVerdict {
  const mediaType = String(headers.contentType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") return "unsupported-media-type";

  const site = String(headers.secFetchSite ?? "").trim().toLowerCase();
  if (site && site !== "same-origin" && site !== "none") return "cross-origin";

  return "ok";
}
