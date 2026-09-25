/**
 * `script-src` da CSP.
 *
 * Em produção era `'self' 'unsafe-inline' https:`, ou seja: qualquer script
 * servido por HTTPS, de qualquer domínio, era aceito. Um XSS que conseguisse
 * injetar um `<script src>` carregava o que quisesse. Agora a lista é explícita:
 * só os domínios que o front de fato carrega.
 *
 * - googletagmanager: Google Analytics (`@next/third-parties`, `NEXT_PUBLIC_GA_ID`)
 * - apis.google.com: `signInWithPopup`/`signInWithRedirect` do Firebase (gapi)
 * - www.google.com + www.gstatic.com: `RecaptchaVerifier` do Firebase
 * - challenges.cloudflare.com: Turnstile do cadastro (`lib/captcha.ts`)
 * - vercel.live: barra de comentários dos previews da Vercel
 *
 * Vercel Analytics e Speed Insights são servidos pela própria origem
 * (`/_vercel/...`), então `'self'` os cobre. Ao acrescentar um SDK que injeta
 * script de outro domínio, acrescente o domínio aqui: sem isso ele é bloqueado
 * em produção e o console mostra a violação de CSP.
 *
 * `'unsafe-inline'` continua: o Next injeta scripts inline de hidratação, e
 * trocar por nonce obrigaria toda página a renderizar dinamicamente (as páginas
 * de marketing perderiam a geração estática e o orçamento do Lighthouse).
 */
export const SCRIPT_SRC_ALLOWED_ORIGINS = [
  "https://www.googletagmanager.com",
  "https://apis.google.com",
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://challenges.cloudflare.com",
  "https://vercel.live",
] as const;

export function buildScriptSrc(isDevelopment: boolean): string {
  if (isDevelopment) return "'self' 'unsafe-inline' 'unsafe-eval' https:";
  return ["'self'", "'unsafe-inline'", ...SCRIPT_SRC_ALLOWED_ORIGINS].join(" ");
}
