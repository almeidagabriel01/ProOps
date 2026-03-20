import React from "react";
import Link from "next/link";
import { ProOpsLogo } from "@/components/branding/proops-logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-black/10 bg-white pb-10 pt-16 dark:border-white/10 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2">
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
              ProOps e um sistema ERP para gestao de servicos com foco em CRM,
              propostas, financeiro, agenda, catalogo, carteiras e operacao
              comercial.
            </p>
            <p className="mt-4 text-sm text-black/55 dark:text-white/55">
              Suporte oficial:{" "}
              <a
                href="mailto:gestao@proops.com.br"
                className="transition-colors hover:text-black dark:hover:text-white"
              >
                gestao@proops.com.br
              </a>
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-black dark:text-white">
              Produto
            </h4>
            <ul className="space-y-3 text-sm text-black/65 dark:text-white/70">
              <li>
                <Link
                  href="#showcase"
                  className="cursor-pointer transition-colors hover:text-black dark:hover:text-white"
                >
                  Plataforma
                </Link>
              </li>
              <li>
                <Link
                  href="#modulos"
                  className="cursor-pointer transition-colors hover:text-black dark:hover:text-white"
                >
                  Modulos
                </Link>
              </li>
              <li>
                <Link
                  href="#recursos"
                  className="cursor-pointer transition-colors hover:text-black dark:hover:text-white"
                >
                  Recursos
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-black dark:text-white">
              Institucional
            </h4>
            <ul className="space-y-3 text-sm text-black/65 dark:text-white/70">
              <li>
                <Link
                  href="/privacy"
                  className="cursor-pointer transition-colors hover:text-black dark:hover:text-white"
                >
                  Politica de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="cursor-pointer transition-colors hover:text-black dark:hover:text-white"
                >
                  Termos de Servico
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="cursor-pointer transition-colors hover:text-black dark:hover:text-white"
                >
                  Area do Cliente
                </Link>
              </li>
              <li>
                <a
                  href="mailto:gestao@proops.com.br"
                  className="cursor-pointer transition-colors hover:text-black dark:hover:text-white"
                >
                  gestao@proops.com.br
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-black/10 pt-8 text-sm text-black/55 dark:border-white/10 dark:text-white/55 md:flex-row">
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
