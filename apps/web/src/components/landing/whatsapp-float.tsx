import React from "react";
import { WHATSAPP_HREF } from "./_shared/whatsapp";
import { WhatsAppGlyph } from "./_shared/whatsapp-glyph";

/**
 * Botão flutuante de WhatsApp da landing (canto inferior direito). Monocromático
 * para casar com o redesign preto & branco; anel de "ping" sutil só com motion
 * habilitado. Abre uma conversa em wa.me com mensagem pré-preenchida.
 */
export function WhatsAppFloat() {
  if (!WHATSAPP_HREF) return null;

  return (
    <a
      href={WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      title="Falar no WhatsApp"
      className="group fixed bottom-6 right-6 z-50 inline-flex items-center"
    >
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-black text-white shadow-[0_12px_30px_-8px_rgba(0,0,0,0.5)] transition-transform duration-300 hover:scale-105 dark:bg-white dark:text-black">
        <span
          aria-hidden
          className="animate-fab-ping absolute inset-0 rounded-full bg-black/40 dark:bg-white/40"
        />
        <WhatsAppGlyph className="relative h-7 w-7" />
      </span>

      {/* rótulo que expande no hover (desktop) */}
      <span className="pointer-events-none ml-0 hidden max-w-0 items-center overflow-hidden whitespace-nowrap rounded-full bg-black text-sm font-semibold text-white opacity-0 transition-all duration-500 ease-out group-hover:ml-3 group-hover:max-w-[12rem] group-hover:px-4 group-hover:py-2.5 group-hover:opacity-100 dark:bg-white dark:text-black md:inline-flex">
        Falar no WhatsApp
      </span>
    </a>
  );
}
