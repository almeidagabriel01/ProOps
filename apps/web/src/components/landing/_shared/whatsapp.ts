// Landing (float button, CTA, footer) usa o número de SUPORTE da ProOps.
import {
  SUPPORT_WHATSAPP_DIGITS,
  buildWhatsAppHref,
} from "@/lib/whatsapp-contacts";

export const WHATSAPP_PHONE_DIGITS = SUPPORT_WHATSAPP_DIGITS;

export const WHATSAPP_MESSAGE =
  "Olá! Vim pela landing da ProOps e gostaria de saber mais sobre a plataforma.";

export const WHATSAPP_HREF = buildWhatsAppHref(
  SUPPORT_WHATSAPP_DIGITS,
  WHATSAPP_MESSAGE,
);

export const INSTAGRAM_HREF = "https://www.instagram.com/proops.solutions/";
