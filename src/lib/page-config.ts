/**
 * Page Mapping Configuration
 * 
 * Centralized mapping of URL paths to Firestore pageIds.
 * This allows the authorization system to look up permissions
 * based on the current route.
 * 
 * IMPORTANT: This is the single source of truth for page-to-permission mapping.
 * When adding new pages, add them here first.
 */

// ============================================
// TYPES
// ============================================

export interface PageConfig {
  pageId: string;          // Firestore document ID in pages/{pageId}
  slug: string;            // URL path
  name: string;            // Display name
  module?: string;         // Module grouping (e.g., "financial", "proposals")
  requiresAuth: boolean;   // Does this page require authentication?
  requiredPermission?: 'view' | 'create' | 'edit' | 'delete'; // Minimum permission level
  masterOnly?: boolean;    // Only MASTER users can access
  hideForMember?: boolean; // Hide from MEMBERs in navigation
}

// ============================================
// PAGE CONFIGURATION
// ============================================

export const PAGE_CONFIG: Record<string, PageConfig> = {
  // Public pages (no auth required)
  '/': {
    pageId: 'home',
    slug: '/',
    name: 'Home',
    requiresAuth: false,
  },
  '/login': {
    pageId: 'login',
    slug: '/login',
    name: 'Login',
    requiresAuth: false,
  },
  '/register': {
    pageId: 'register',
    slug: '/register',
    name: 'Criar Conta',
    requiresAuth: false,
  },
  '/forgot-password': {
    pageId: 'forgot-password',
    slug: '/forgot-password',
    name: 'Redefinir Senha',
    requiresAuth: false,
  },
  '/email-verification-pending': {
    pageId: 'email-verification-pending',
    slug: '/email-verification-pending',
    name: 'Confirmação de E-mail',
    requiresAuth: false,
  },
  '/subscribe': {
    pageId: 'subscribe',
    slug: '/subscribe',
    name: 'Escolher Plano',
    requiresAuth: false,
  },
  
  // Protected pages (require auth + permissions)
  '/dashboard': {
    pageId: 'dashboard',
    slug: '/dashboard',
    name: 'Dashboard',
    module: 'core',
    requiresAuth: true,
    requiredPermission: 'view',
  },
  '/proposals': {
    pageId: 'proposals',
    slug: '/proposals',
    name: 'Propostas',
    module: 'proposals',
    requiresAuth: true,
    requiredPermission: 'view',
  },
  '/proposals/new': {
    pageId: 'proposals', // Same permission as /proposals
    slug: '/proposals/new',
    name: 'Nova Proposta',
    module: 'proposals',
    requiresAuth: true,
    requiredPermission: 'create',
  },
  '/clients': {
    pageId: 'clients',
    slug: '/clients',
    name: 'Clientes',
    module: 'clients',
    requiresAuth: true,
    requiredPermission: 'view',
  },
  '/products': {
    pageId: 'products',
    slug: '/products',
    name: 'Produtos',
    module: 'products',
    requiresAuth: true,
    requiredPermission: 'view',
  },
  '/financial': {
    pageId: 'financial',
    slug: '/financial',
    name: 'Financeiro',
    module: 'financial',
    requiresAuth: true,
    requiredPermission: 'view',
  },
  '/settings': {
    pageId: 'settings',
    slug: '/settings',
    name: 'Configurações',
    module: 'settings',
    requiresAuth: true,
    requiredPermission: 'view',
  },
  '/profile': {
    pageId: 'profile',
    slug: '/profile',
    name: 'Perfil',
    module: 'core',
    requiresAuth: true,
    requiredPermission: 'view',
  },
  
  // MASTER-only pages
  '/team': {
    pageId: 'team',
    slug: '/team',
    name: 'Equipe',
    module: 'settings',
    requiresAuth: true,
    requiredPermission: 'view',
    masterOnly: true,
  },
  '/settings/billing': {
    pageId: 'billing',
    slug: '/settings/billing',
    name: 'Plano e Cobrança',
    module: 'settings',
    requiresAuth: true,
    requiredPermission: 'view',
    masterOnly: true,
    hideForMember: true, // Hide completely from MEMBERs
  },
  
  // Admin pages (superadmin only - handled separately)
  '/admin': {
    pageId: 'admin',
    slug: '/admin',
    name: 'Admin',
    module: 'admin',
    requiresAuth: true,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get page configuration from a URL path.
 * Handles dynamic routes by matching the base path.
 */
export function getPageConfig(pathname: string): PageConfig | null {
  // Direct match
  if (PAGE_CONFIG[pathname]) {
    return PAGE_CONFIG[pathname];
  }
  
  // Try to match parent paths (e.g., /proposals/123 → /proposals)
  const segments = pathname.split('/').filter(Boolean);
  
  // Check from most specific to least specific
  for (let i = segments.length; i > 0; i--) {
    const partialPath = '/' + segments.slice(0, i).join('/');
    if (PAGE_CONFIG[partialPath]) {
      return PAGE_CONFIG[partialPath];
    }
  }
  
  return null;
}

/**
 * Get the pageId for a given pathname
 */
export function getPageId(pathname: string): string | null {
  const config = getPageConfig(pathname);
  return config?.pageId ?? null;
}

/**
 * Check if a page requires authentication
 */
export function pageRequiresAuth(pathname: string): boolean {
  const config = getPageConfig(pathname);
  return config?.requiresAuth ?? true; // Default to requiring auth
}

/**
 * Check if a page is MASTER-only
 */
export function pageIsMasterOnly(pathname: string): boolean {
  const config = getPageConfig(pathname);
  return config?.masterOnly ?? false;
}

/**
 * Get all pages for a specific module
 */
export function getPagesByModule(module: string): PageConfig[] {
  return Object.values(PAGE_CONFIG).filter(page => page.module === module);
}

/**
 * Get all protected pages (for building navigation)
 */
export function getProtectedPages(): PageConfig[] {
  return Object.values(PAGE_CONFIG).filter(page => page.requiresAuth);
}
