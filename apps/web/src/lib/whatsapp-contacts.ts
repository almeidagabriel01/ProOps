// Números de WhatsApp da ProOps. São DOIS números distintos para situações
// distintas — não devem compartilhar a mesma variável:
//   - Suporte (humano/vendas): usado na landing pública (FAB, footer, CTA).
//   - Bot (assistente): usado no app autenticado por tenants com WhatsApp habilitado.
// Cada um pode ser sobrescrito por seu próprio env; senão usa o default fixo.
const SUPPORT_RAW =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER || "+55 51 99348-9758";
const BOT_RAW =
  process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER || "+55 35 98421-9483";

export const SUPPORT_WHATSAPP_NUMBER = SUPPORT_RAW;
export const BOT_WHATSAPP_NUMBER = BOT_RAW;
export const SUPPORT_WHATSAPP_DIGITS = SUPPORT_RAW.replace(/\D/g, "");
export const BOT_WHATSAPP_DIGITS = BOT_RAW.replace(/\D/g, "");

export function buildWhatsAppHref(digits: string, message?: string): string {
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
