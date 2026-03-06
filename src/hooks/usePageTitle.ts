"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/login": "Login",
  "/register": "Criar Conta",
  "/forgot-password": "Redefinir Senha",
  "/email-verification-pending": "Confirmacao de E-mail",
  "/403": "Acesso Negado",

  "/dashboard": "Dashboard | ProOps",
  "/products": "Produtos | ProOps",
  "/proposals": "Propostas | ProOps",
  "/crm": "CRM | ProOps",
  "/contacts": "Contatos | ProOps",
  "/transactions": "Lancamentos | ProOps",
  "/wallets": "Carteiras | ProOps",
  "/services": "Servicos | ProOps",
  "/solutions": "Solucoes | ProOps",
  "/profile": "Meu Perfil | ProOps",
  "/settings": "Configuracoes | ProOps",
  "/team": "Equipe | ProOps",
  "/settings/billing": "Plano | ProOps",

  "/subscribe": "Assinar Plano",
  "/checkout-success": "Pagamento Confirmado",
  "/addon-success": "Addon Adquirido",

  "/admin": "Admin | ProOps",
  "/admin/billing": "Cobranca | Admin",
  "/admin/tenants": "Empresas | Admin",

  "/": "Home",
};

function getDynamicTitle(pathname: string): string | null {
  if (pathname.startsWith("/products/new")) return "Novo Produto | ProOps";
  if (pathname.match(/^\/products\/[^/]+\/edit$/))
    return "Editar Produto | ProOps";
  if (pathname.match(/^\/products\/[^/]+$/)) return "Produto | ProOps";

  if (pathname.startsWith("/proposals/new")) return "Nova Proposta | ProOps";
  if (pathname.match(/^\/proposals\/[^/]+\/edit$/))
    return "Editar Proposta | ProOps";
  if (pathname.match(/^\/proposals\/[^/]+\/edit-pdf$/))
    return "Editar PDF | ProOps";
  if (pathname.match(/^\/proposals\/[^/]+$/)) return "Proposta | ProOps";

  if (pathname.startsWith("/contacts/new")) return "Novo Contato | ProOps";
  if (pathname.match(/^\/contacts\/[^/]+\/edit$/))
    return "Editar Contato | ProOps";
  if (pathname.match(/^\/contacts\/[^/]+$/)) return "Contato | ProOps";

  if (pathname.startsWith("/transactions/new"))
    return "Novo Lancamento | ProOps";
  if (pathname.match(/^\/transactions\/[^/]+$/))
    return "Lancamento | ProOps";

  if (pathname.startsWith("/services/new")) return "Novo Servico | ProOps";
  if (pathname.match(/^\/services\/[^/]+$/)) return "Servico | ProOps";

  if (pathname.match(/^\/profile\/[^/]+$/))
    return "Perfil do Usuario | ProOps";

  return null;
}

export function usePageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const dynamicTitle = getDynamicTitle(pathname);
    if (dynamicTitle) {
      document.title = dynamicTitle;
      return;
    }

    const exactTitle = PAGE_TITLES[pathname];
    if (exactTitle) {
      document.title = exactTitle;
      return;
    }

    const sortedPaths = Object.keys(PAGE_TITLES)
      .filter((path) => pathname.startsWith(path) && path !== "/")
      .sort((a, b) => b.length - a.length);

    if (sortedPaths.length > 0) {
      document.title = PAGE_TITLES[sortedPaths[0]];
      return;
    }

    document.title = "ProOps";
  }, [pathname]);
}
