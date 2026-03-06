import React from "react";
import Link from "next/link";
import { Layers } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded bg-brand-500 flex items-center justify-center">
                <Layers className="text-white w-4 h-4" />
              </div>
              <span className="font-bold text-lg tracking-tight text-foreground">
                NexERP
              </span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed mb-6">
              O sistema de gestão empresarial definitivo para negócios que
              procuram performance, design intuitivo e segurança máxima numa
              única plataforma.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-foreground">O Produto</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link
                  href="#recursos"
                  className="hover:text-foreground transition-colors"
                >
                  Funcionalidades
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  className="hover:text-foreground transition-colors"
                >
                  Preços & Planos
                </Link>
              </li>
              <li>
                <Link
                  href="#integrations"
                  className="hover:text-foreground transition-colors"
                >
                  Integrações
                </Link>
              </li>
              <li>
                <Link
                  href="#updates"
                  className="hover:text-foreground transition-colors"
                >
                  Atualizações
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-foreground">A Empresa</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link
                  href="#sobre"
                  className="hover:text-foreground transition-colors"
                >
                  Sobre Nós
                </Link>
              </li>
              <li>
                <Link
                  href="#recursos"
                  className="hover:text-foreground transition-colors"
                >
                  Centro de Recursos
                </Link>
              </li>
              <li>
                <Link
                  href="#carreiras"
                  className="hover:text-foreground transition-colors"
                >
                  Carreiras
                </Link>
              </li>
              <li>
                <Link
                  href="#contato"
                  className="hover:text-foreground transition-colors"
                >
                  Fale Connosco
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} NexERP. Todos os direitos
            reservados.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Termos de Serviço
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
