import React from "react";
import Link from "next/link";
import { ProOpsLogo } from "@/components/branding/proops-logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950 pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="col-span-2">
            <Link
              href="/"
              className="inline-flex items-center mb-6 cursor-pointer"
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
            <p className="text-black/65 dark:text-white/70 text-sm max-w-sm leading-relaxed">
              Plataforma de gestão com foco em propostas, financeiro, CRM em
              kanban, carteiras, catálogo, planilhas e operação comercial em um
              único lugar.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-black dark:text-white">
              Produto
            </h4>
            <ul className="space-y-3 text-sm text-black/65 dark:text-white/70">
              <li>
                <Link
                  href="#showcase"
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Plataforma
                </Link>
              </li>
              <li>
                <Link
                  href="#modulos"
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Módulos
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Planos
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-black dark:text-white">
              Suporte
            </h4>
            <ul className="space-y-3 text-sm text-black/65 dark:text-white/70">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Termos de Serviço
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Área do Cliente
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-black/10 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-black/55 dark:text-white/55">
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
        </div>
      </div>
    </footer>
  );
}
