"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// ============================================
// PAGE TITLE MAPPINGS
// ============================================

const PAGE_TITLES: Record<string, string> = {
  // Auth pages
  "/login": "Login",
  "/register": "Criar Conta",
  "/forgot-password": "Redefinir Senha",
  "/403": "Acesso Negado",

  // ERP pages
  "/dashboard": "Dashboard | ERP",
  "/products": "Produtos | ERP",
  "/proposals": "Propostas | ERP",
  "/contacts": "Contatos | ERP",
  "/financial": "Financeiro | ERP",
  "/solutions": "Soluções | ERP",
  "/profile": "Meu Perfil | ERP",
  "/settings": "Configurações | ERP",
  "/settings/team": "Equipe | ERP",
  "/settings/billing": "Plano | ERP",

  // Subscribe/Checkout pages
  "/subscribe": "Assinar Plano",
  "/checkout-success": "Pagamento Confirmado",
  "/addon-success": "Addon Adquirido",

  // Admin pages
  "/admin": "Admin | ERP",
  "/admin/billing": "Cobrança | Admin",
  "/admin/tenants": "Empresas | Admin",

  // Landing page
  "/": "Home",
};

// ============================================
// DYNAMIC TITLE PATTERNS
// ============================================

function getDynamicTitle(pathname: string): string | null {
  // Products
  if (pathname.startsWith("/products/new")) return "Novo Produto | ERP";
  if (pathname.match(/^\/products\/[^/]+\/edit$/))
    return "Editar Produto | ERP";
  if (pathname.match(/^\/products\/[^/]+$/)) return "Produto | ERP";

  // Proposals
  if (pathname.startsWith("/proposals/new")) return "Nova Proposta | ERP";
  if (pathname.match(/^\/proposals\/[^/]+\/edit$/))
    return "Editar Proposta | ERP";
  if (pathname.match(/^\/proposals\/[^/]+\/edit-pdf$/))
    return "Editar PDF | ERP";
  if (pathname.match(/^\/proposals\/[^/]+$/)) return "Proposta | ERP";

  // Contacts
  if (pathname.startsWith("/contacts/new")) return "Novo Contato | ERP";
  if (pathname.match(/^\/contacts\/[^/]+\/edit$/))
    return "Editar Contato | ERP";
  if (pathname.match(/^\/contacts\/[^/]+$/)) return "Contato | ERP";

  // Financial
  if (pathname.startsWith("/financial/new")) return "Novo Lançamento | ERP";
  if (pathname.match(/^\/financial\/[^/]+$/)) return "Lançamento | ERP";

  // Profile by ID (superadmin viewing user)
  if (pathname.match(/^\/profile\/[^/]+$/)) return "Perfil do Usuário | ERP";

  return null;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook that sets the document title based on the current route.
 * Should be called in the root layout to apply globally.
 */
export function usePageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    // First check dynamic patterns
    const dynamicTitle = getDynamicTitle(pathname);
    if (dynamicTitle) {
      document.title = dynamicTitle;
      return;
    }

    // Then check exact matches
    const exactTitle = PAGE_TITLES[pathname];
    if (exactTitle) {
      document.title = exactTitle;
      return;
    }

    // Fallback: find the closest matching prefix
    const sortedPaths = Object.keys(PAGE_TITLES)
      .filter((path) => pathname.startsWith(path) && path !== "/")
      .sort((a, b) => b.length - a.length);

    if (sortedPaths.length > 0) {
      document.title = PAGE_TITLES[sortedPaths[0]];
      return;
    }

    // Default fallback
    document.title = "ERP";
  }, [pathname]);
}
