// Número de WhatsApp da ProOps usado na landing (float button, CTA, footer).
// Pode ser sobrescrito por NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER; senão usa o padrão.
const RAW_PHONE =
  process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER || "+55 51 99348-9758";

export const WHATSAPP_PHONE_DIGITS = RAW_PHONE.replace(/\D/g, "");

export const WHATSAPP_MESSAGE =
  "Olá! Vim pela landing da ProOps e gostaria de saber mais sobre a plataforma.";

export const WHATSAPP_HREF = WHATSAPP_PHONE_DIGITS
  ? `https://wa.me/${WHATSAPP_PHONE_DIGITS}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
  : "";

export const INSTAGRAM_HREF = "https://www.instagram.com/proops.solutions/";
