"use client";

import React from "react";
import Link from "next/link";
import { m as motion } from "motion/react";
import { Instagram } from "lucide-react";
import { ProOpsLogo } from "@/components/branding/proops-logo";
import { INSTAGRAM_HREF, WHATSAPP_HREF } from "./_shared/whatsapp";
import { WhatsAppGlyph } from "./_shared/whatsapp-glyph";
import { LandingButton } from "./_shared/landing-button";

export function LandingFooter() {
  return (
    <footer className="border-t border-black/10 bg-white pb-10 pt-16 dark:border-white/10 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 grid grid-cols-2 gap-10 md:grid-cols-4">
          <motion.div
            className="col-span-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href="/"
              className="mb-6 inline-flex items-center cursor-pointer"
            >
              <ProOpsLogo
                variant="full"
                width={230}
                height={80}
                invertOnDark
                interactive={false}
                className="h-12 w-auto origin-left scale-[1.35]"
              />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-black/65 dark:text-white/70">
              ProOps é um sistema ERP para gestão de serviços com foco em CRM,
              propostas, financeiro, agenda, catálogo, carteiras e operação
              comercial.
            </p>
            <p className="mt-4 text-sm text-black/55 dark:text-white/55">
              Suporte oficial:{" "}
              <LandingButton
                href="mailto:gestao@proops.com.br"
                external
                variant="link"
                tone="muted"
              >
                gestao@proops.com.br
              </LandingButton>
            </p>

            <div className="mt-6 flex items-center gap-3">
              <a
                href={INSTAGRAM_HREF}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram da ProOps"
                className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-black/70 transition-colors hover:border-black/25 hover:text-black dark:border-white/10 dark:text-white/70 dark:hover:border-white/25 dark:hover:text-white"
              >
                <Instagram className="h-5 w-5" />
              </a>
              {WHATSAPP_HREF && (
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp da ProOps"
                  className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-black/70 transition-colors hover:border-black/25 hover:text-black dark:border-white/10 dark:text-white/70 dark:hover:border-white/25 dark:hover:text-white"
                >
                  <WhatsAppGlyph className="h-5 w-5" />
                </a>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <h4 className="mb-4 font-semibold text-black dark:text-white">
              Produto
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <LandingButton href="#showcase" variant="link" tone="muted">
                  Plataforma
                </LandingButton>
              </li>
              <li>
                <LandingButton href="#modulos" variant="link" tone="muted">
                  Módulos
                </LandingButton>
              </li>
              <li>
                <LandingButton href="#recursos" variant="link" tone="muted">
                  Recursos
                </LandingButton>
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <h4 className="mb-4 font-semibold text-black dark:text-white">
              Institucional
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <LandingButton href="/privacy" variant="link" tone="muted">
                  Política de Privacidade
                </LandingButton>
              </li>
              <li>
                <LandingButton href="/terms" variant="link" tone="muted">
                  Termos de Serviço
                </LandingButton>
              </li>
              <li>
                <LandingButton href="/data-deletion" variant="link" tone="muted">
                  Exclusão de Dados
                </LandingButton>
              </li>
              <li>
                <LandingButton href="/cookies" variant="link" tone="muted">
                  Política de Cookies
                </LandingButton>
              </li>
              <li>
                <LandingButton href="/login" variant="link" tone="muted">
                  Área do Cliente
                </LandingButton>
              </li>
              <li>
                <LandingButton
                  href="mailto:gestao@proops.com.br"
                  external
                  variant="link"
                  tone="muted"
                >
                  gestao@proops.com.br
                </LandingButton>
              </li>
            </ul>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center justify-between gap-4 border-t border-black/10 pt-8 text-sm text-black/55 dark:border-white/10 dark:text-white/55 md:flex-row"
        >
          <p className="flex items-center gap-2">
            <ProOpsLogo
              variant="symbol"
              width={16}
              height={16}
              invertOnDark
              className="h-4 w-4"
            />
            &copy; {new Date().getFullYear()} ProOps. Todos os direitos
            reservados.
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
