export type Tenant = {
    id: string
    name: string
    slug: string
    primaryColor: string // Hex code
    logoUrl?: string
    createdAt: string
}

export type Product = {
    id: string
    tenantId: string
    name: string
    description: string
    price: string
    manufacturer: string
    category: string
    sku: string
    stock: string
    image?: string | null
}

export type User = {
    id: string
    tenantId: string
    name: string
    email: string
    password: string // In real world this is hashed
    role: 'admin' | 'user' | 'superadmin'
}

const KEYS = {
    TENANTS: 'saas_tenants',
    PRODUCTS: 'saas_products',
    CURRENT_TENANT: 'saas_current_tenant_id',
    USERS: 'saas_users',
    CURRENT_USER: 'saas_current_user_id',
    VIEWING_AS_TENANT: 'saas_viewing_as_tenant_id'
}

export const MockDB = {
    // --- User / Auth Operations ---
    getUsers: (): User[] => {
        if (typeof window === 'undefined') return []
        const data = localStorage.getItem(KEYS.USERS)
        return data ? JSON.parse(data) : []
    },

    createUser: (tenantId: string, email: string, name: string, password?: string): User => {
        const users = MockDB.getUsers()
        // Check if exists
        const existing = users.find(u => u.email === email)
        if (existing) return existing

        const newUser: User = {
            id: crypto.randomUUID(),
            tenantId,
            email,
            name,
            password: password || '123', // Use provided or default
            role: 'admin'
        }
        localStorage.setItem(KEYS.USERS, JSON.stringify([...users, newUser]))
        return newUser
    },

    authenticate: (email: string, password: string): User | null => {
        // Hardcoded Super Admin
        if (email === 'master@erp.com' && password === 'root') {
            return {
                id: 'super-admin-id',
                tenantId: 'system',
                name: 'Super Admin',
                email: 'master@erp.com',
                password: 'root',
                role: 'superadmin' // New Role
            } as User
        }

        const users = MockDB.getUsers()
        const user = users.find(u => u.email === email && u.password === password)
        return user || null
    },

    getCurrentUser: (): User | null => {
        if (typeof window === 'undefined') return null
        const id = localStorage.getItem(KEYS.CURRENT_USER)
        if (!id) return null
        return MockDB.getUsers().find(u => u.id === id) || null
    },

    setCurrentUser: (id: string) => {
        localStorage.setItem(KEYS.CURRENT_USER, id)
    },

    logout: () => {
        localStorage.removeItem(KEYS.CURRENT_USER)
        localStorage.removeItem(KEYS.CURRENT_TENANT)
    },

    // --- Tenant Operations ---
    getTenants: (): Tenant[] => {
        if (typeof window === 'undefined') return []
        const data = localStorage.getItem(KEYS.TENANTS)
        return data ? JSON.parse(data) : []
    },

    createTenant: (networkName: string, color: string, logoUrl?: string): Tenant => {
        const tenants = MockDB.getTenants()
        const newTenant: Tenant = {
            id: crypto.randomUUID(),
            name: networkName,
            slug: networkName.toLowerCase().replace(/\s+/g, '-'),
            primaryColor: color,
            logoUrl,
            createdAt: new Date().toISOString()
        }
        localStorage.setItem(KEYS.TENANTS, JSON.stringify([...tenants, newTenant]))
        return newTenant
    },

    updateTenant: (id: string, data: Partial<Omit<Tenant, 'id' | 'createdAt'>>) => {
        const tenants = MockDB.getTenants()
        const updated = tenants.map(t => t.id === id ? { ...t, ...data } : t)
        localStorage.setItem(KEYS.TENANTS, JSON.stringify(updated))
    },

    deleteTenant: (id: string) => {
        const tenants = MockDB.getTenants()
        const filtered = tenants.filter(t => t.id !== id)
        localStorage.setItem(KEYS.TENANTS, JSON.stringify(filtered))
    },

    getTenantById: (id: string): Tenant | undefined => {
        return MockDB.getTenants().find(t => t.id === id)
    },

    // --- Session Operations (Old/Direct) ---
    setCurrentTenantId: (id: string) => {
        localStorage.setItem(KEYS.CURRENT_TENANT, id)
    },

    getCurrentTenantId: (): string | null => {
        if (typeof window === 'undefined') return null
        return localStorage.getItem(KEYS.CURRENT_TENANT)
    },

    // --- Product Operations (Scoped) ---
    getProducts: (tenantId: string): Product[] => {
        if (typeof window === 'undefined') return []
        const data = localStorage.getItem(KEYS.PRODUCTS)
        const allProducts: Product[] = data ? JSON.parse(data) : []
        return allProducts.filter(p => p.tenantId === tenantId)
    },

    createProduct: (tenantId: string, data: Omit<Product, 'id' | 'tenantId'>) => {
        const allProductsStr = localStorage.getItem(KEYS.PRODUCTS)
        const allProducts: Product[] = allProductsStr ? JSON.parse(allProductsStr) : []

        const newProduct: Product = {
            ...data,
            id: crypto.randomUUID(),
            tenantId
        }

        localStorage.setItem(KEYS.PRODUCTS, JSON.stringify([...allProducts, newProduct]))
        return newProduct
    },

    // --- Super Admin Viewing As Tenant ---
    setViewingAsTenant: (tenantId: string) => {
        localStorage.setItem(KEYS.VIEWING_AS_TENANT, tenantId)
        localStorage.setItem(KEYS.CURRENT_TENANT, tenantId) // Also set current tenant for data loading
    },

    getViewingAsTenant: (): string | null => {
        if (typeof window === 'undefined') return null
        return localStorage.getItem(KEYS.VIEWING_AS_TENANT)
    },

    clearViewingAsTenant: () => {
        localStorage.removeItem(KEYS.VIEWING_AS_TENANT)
        localStorage.removeItem(KEYS.CURRENT_TENANT)
    }
}
