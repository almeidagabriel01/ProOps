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

export type ProposalSectionType = 'text' | 'table' | 'image' | 'list' | 'separator' | 'header' | 'custom-field' | 'hierarchical-field'

export type TextStyle = {
    color?: string
    fontSize?: number
    fontWeight?: 'normal' | 'bold'
    fontStyle?: 'normal' | 'italic'
    textAlign?: 'left' | 'center' | 'right' | 'justify'
    textDecoration?: 'none' | 'underline'
}

export type ImageStyle = {
    width?: number // Percentage 25-100
    align?: 'left' | 'center' | 'right'
    borderRadius?: number
    shadow?: boolean
    margin?: 'small' | 'medium' | 'large'
}

export type ProposalSection = {
    id: string
    type: ProposalSectionType
    title: string
    content: string // JSON stringified content based on type
    order: number
    textStyle?: TextStyle
    imageStyle?: ImageStyle
}

export type ProposalTableItem = {
    id: string
    name: string
    description?: string
    quantity: number
    unitPrice: number
    total: number
}

export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected'

export type Proposal = {
    id: string
    tenantId: string
    templateId?: string  // Reference to ProposalTemplate
    title: string
    clientName: string
    clientEmail?: string
    clientPhone?: string
    clientAddress?: string
    validUntil: string
    status: ProposalStatus
    products: ProposalProduct[]  // Selected products
    sections?: ProposalSection[] // Legacy support
    customNotes?: string
    discount?: number  // Percentage
    linkedFields?: {  // Campos vinculados personalizados (e.g., Ambiente → Sistema)
        parentTypeId: string
        childTypeId: string
        entries: Array<{
            id: string
            parentItemId: string
            childItemIds: string[]
        }>
    }
    createdAt: string
    updatedAt: string
}

export type ProposalPdfSettings = {
    primaryColor: string
    secondaryColor?: string
    fontFamily: string
    includeLogo: boolean
    includeHeader: boolean
    includeFooter: boolean
    margins: 'normal' | 'narrow' | 'wide'
}

// Custom Fields for tenant-specific categories (e.g., Ambiente, Sistema)
export type CustomFieldItem = {
    id: string
    label: string
    image?: string // Base64 encoded image
    description?: string
    parentItemIds?: string[] // For linked fields: which parent items this belongs to
}

export type CustomFieldType = {
    id: string
    tenantId: string
    name: string // "Ambiente", "Sistema"
    description?: string
    parentTypeId?: string // For linked fields: if set, this field depends on another
    items: CustomFieldItem[]
    createdAt: string
}

// Proposal Template - Pre-configured text blocks for proposals
export type ProposalTemplate = {
    id: string
    tenantId: string
    name: string
    isDefault: boolean
    introductionText: string      // "Prezado cliente, temos o prazer..."
    scopeText: string             // "O escopo deste projeto inclui..."
    paymentTerms: string          // "Condições de pagamento..."
    warrantyText: string          // "Garantia de X meses..."
    footerText: string            // "Atenciosamente, Equipe..."
    coverImage?: string           // Base64 cover image
    theme: 'modern' | 'classic' | 'minimal' | 'tech' | 'elegant' | 'bold'
    primaryColor: string
    fontFamily: string
    repeatHeader?: boolean
}

// Product selection for proposals
export type ProposalProduct = {
    productId: string
    productName: string
    productImage?: string  // Product image URL/Base64
    productDescription?: string
    quantity: number
    unitPrice: number
    total: number
    manufacturer?: string
    category?: string
}


const KEYS = {
    TENANTS: 'saas_tenants',
    PRODUCTS: 'saas_products',
    PROPOSALS: 'saas_proposals',
    PROPOSAL_TEMPLATES: 'saas_proposal_templates',
    CUSTOM_FIELDS: 'saas_custom_fields',
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
            const superAdmin: User = {
                id: 'super-admin-id',
                tenantId: 'system',
                name: 'Super Admin',
                email: 'master@erp.com',
                password: 'root',
                role: 'superadmin'
            }
            // Ensure super admin is in users list for getCurrentUser to find
            const users = MockDB.getUsers()
            if (!users.find(u => u.id === superAdmin.id)) {
                localStorage.setItem(KEYS.USERS, JSON.stringify([...users, superAdmin]))
            }
            return superAdmin
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
    },

    // --- Proposal Operations ---
    getProposals: (tenantId: string): Proposal[] => {
        if (typeof window === 'undefined') return []
        const data = localStorage.getItem(KEYS.PROPOSALS)
        const allProposals: Proposal[] = data ? JSON.parse(data) : []
        return allProposals.filter(p => p.tenantId === tenantId)
    },

    getProposalById: (id: string): Proposal | undefined => {
        if (typeof window === 'undefined') return undefined
        const data = localStorage.getItem(KEYS.PROPOSALS)
        const allProposals: Proposal[] = data ? JSON.parse(data) : []
        return allProposals.find(p => p.id === id)
    },

    createProposal: (tenantId: string, data: Omit<Proposal, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Proposal => {
        const allProposalsStr = localStorage.getItem(KEYS.PROPOSALS)
        const allProposals: Proposal[] = allProposalsStr ? JSON.parse(allProposalsStr) : []

        const newProposal: Proposal = {
            ...data,
            id: crypto.randomUUID(),
            tenantId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        localStorage.setItem(KEYS.PROPOSALS, JSON.stringify([...allProposals, newProposal]))
        return newProposal
    },

    updateProposal: (id: string, data: Partial<Omit<Proposal, 'id' | 'tenantId' | 'createdAt'>>): Proposal | null => {
        const allProposalsStr = localStorage.getItem(KEYS.PROPOSALS)
        const allProposals: Proposal[] = allProposalsStr ? JSON.parse(allProposalsStr) : []

        const index = allProposals.findIndex(p => p.id === id)
        if (index === -1) return null

        const updated: Proposal = {
            ...allProposals[index],
            ...data,
            updatedAt: new Date().toISOString()
        }

        allProposals[index] = updated
        localStorage.setItem(KEYS.PROPOSALS, JSON.stringify(allProposals))
        return updated
    },

    deleteProposal: (id: string): boolean => {
        const allProposalsStr = localStorage.getItem(KEYS.PROPOSALS)
        const allProposals: Proposal[] = allProposalsStr ? JSON.parse(allProposalsStr) : []

        const filtered = allProposals.filter(p => p.id !== id)
        if (filtered.length === allProposals.length) return false

        localStorage.setItem(KEYS.PROPOSALS, JSON.stringify(filtered))
        return true
    },

    duplicateProposal: (id: string): Proposal | null => {
        const original = MockDB.getProposalById(id)
        if (!original) return null

        const allProposalsStr = localStorage.getItem(KEYS.PROPOSALS)
        const allProposals: Proposal[] = allProposalsStr ? JSON.parse(allProposalsStr) : []

        const duplicate: Proposal = {
            ...original,
            id: crypto.randomUUID(),
            title: `${original.title} (Cópia)`,
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        localStorage.setItem(KEYS.PROPOSALS, JSON.stringify([...allProposals, duplicate]))
        return duplicate
    },

    // --- Custom Field Operations ---
    getCustomFieldTypes: (tenantId: string): CustomFieldType[] => {
        if (typeof window === 'undefined') return []
        const data = localStorage.getItem(KEYS.CUSTOM_FIELDS)
        const allTypes: CustomFieldType[] = data ? JSON.parse(data) : []
        return allTypes.filter(t => t.tenantId === tenantId)
    },

    getCustomFieldTypeById: (id: string): CustomFieldType | undefined => {
        if (typeof window === 'undefined') return undefined
        const data = localStorage.getItem(KEYS.CUSTOM_FIELDS)
        const allTypes: CustomFieldType[] = data ? JSON.parse(data) : []
        return allTypes.find(t => t.id === id)
    },

    createCustomFieldType: (tenantId: string, name: string, description?: string): CustomFieldType => {
        const allTypesStr = localStorage.getItem(KEYS.CUSTOM_FIELDS)
        const allTypes: CustomFieldType[] = allTypesStr ? JSON.parse(allTypesStr) : []

        const newType: CustomFieldType = {
            id: crypto.randomUUID(),
            tenantId,
            name,
            description,
            items: [],
            createdAt: new Date().toISOString()
        }

        localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify([...allTypes, newType]))
        return newType
    },

    updateCustomFieldType: (id: string, data: Partial<Omit<CustomFieldType, 'id' | 'tenantId' | 'createdAt'>>): CustomFieldType | null => {
        const allTypesStr = localStorage.getItem(KEYS.CUSTOM_FIELDS)
        const allTypes: CustomFieldType[] = allTypesStr ? JSON.parse(allTypesStr) : []

        const index = allTypes.findIndex(t => t.id === id)
        if (index === -1) return null

        const updated: CustomFieldType = { ...allTypes[index], ...data }
        allTypes[index] = updated
        localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify(allTypes))
        return updated
    },

    deleteCustomFieldType: (id: string): boolean => {
        const allTypesStr = localStorage.getItem(KEYS.CUSTOM_FIELDS)
        const allTypes: CustomFieldType[] = allTypesStr ? JSON.parse(allTypesStr) : []

        const filtered = allTypes.filter(t => t.id !== id)
        if (filtered.length === allTypes.length) return false

        localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify(filtered))
        return true
    },

    addCustomFieldItem: (typeId: string, label: string, image?: string, description?: string): CustomFieldItem | null => {
        const fieldType = MockDB.getCustomFieldTypeById(typeId)
        if (!fieldType) return null

        const newItem: CustomFieldItem = {
            id: crypto.randomUUID(),
            label,
            image,
            description
        }

        MockDB.updateCustomFieldType(typeId, {
            items: [...fieldType.items, newItem]
        })

        return newItem
    },

    updateCustomFieldItem: (typeId: string, itemId: string, data: Partial<Omit<CustomFieldItem, 'id'>>): CustomFieldItem | null => {
        const fieldType = MockDB.getCustomFieldTypeById(typeId)
        if (!fieldType) return null

        const itemIndex = fieldType.items.findIndex(i => i.id === itemId)
        if (itemIndex === -1) return null

        const updatedItem = { ...fieldType.items[itemIndex], ...data }
        const updatedItems = [...fieldType.items]
        updatedItems[itemIndex] = updatedItem

        MockDB.updateCustomFieldType(typeId, { items: updatedItems })
        return updatedItem
    },

    deleteCustomFieldItem: (typeId: string, itemId: string): boolean => {
        const fieldType = MockDB.getCustomFieldTypeById(typeId)
        if (!fieldType) return false

        const filtered = fieldType.items.filter(i => i.id !== itemId)
        if (filtered.length === fieldType.items.length) return false

        MockDB.updateCustomFieldType(typeId, { items: filtered })
        return true
    },

    // --- Proposal Template Operations ---
    getProposalTemplates: (tenantId: string): ProposalTemplate[] => {
        if (typeof window === 'undefined') return []
        const data = localStorage.getItem(KEYS.PROPOSAL_TEMPLATES)
        const templates: ProposalTemplate[] = data ? JSON.parse(data) : []
        return templates.filter(t => t.tenantId === tenantId)
    },

    getProposalTemplateById: (id: string): ProposalTemplate | null => {
        if (typeof window === 'undefined') return null
        const data = localStorage.getItem(KEYS.PROPOSAL_TEMPLATES)
        const templates: ProposalTemplate[] = data ? JSON.parse(data) : []
        return templates.find(t => t.id === id) || null
    },

    getDefaultTemplate: (tenantId: string): ProposalTemplate | null => {
        const templates = MockDB.getProposalTemplates(tenantId)
        return templates.find(t => t.isDefault) || templates[0] || null
    },

    createProposalTemplate: (tenantId: string, data: Omit<ProposalTemplate, 'id' | 'tenantId'>): ProposalTemplate => {
        const storedData = localStorage.getItem(KEYS.PROPOSAL_TEMPLATES)
        const templates: ProposalTemplate[] = storedData ? JSON.parse(storedData) : []

        const newTemplate: ProposalTemplate = {
            id: crypto.randomUUID(),
            tenantId,
            ...data
        }

        // If this is default, unset other defaults
        if (data.isDefault) {
            templates.forEach(t => {
                if (t.tenantId === tenantId) t.isDefault = false
            })
        }

        localStorage.setItem(KEYS.PROPOSAL_TEMPLATES, JSON.stringify([...templates, newTemplate]))
        return newTemplate
    },

    updateProposalTemplate: (id: string, data: Partial<Omit<ProposalTemplate, 'id' | 'tenantId'>>): ProposalTemplate | null => {
        const storedData = localStorage.getItem(KEYS.PROPOSAL_TEMPLATES)
        const templates: ProposalTemplate[] = storedData ? JSON.parse(storedData) : []
        const index = templates.findIndex(t => t.id === id)
        if (index === -1) return null

        const template = templates[index]

        // If setting as default, unset others
        if (data.isDefault) {
            templates.forEach(t => {
                if (t.tenantId === template.tenantId) t.isDefault = false
            })
        }

        templates[index] = { ...template, ...data }
        localStorage.setItem(KEYS.PROPOSAL_TEMPLATES, JSON.stringify(templates))
        return templates[index]
    },

    deleteProposalTemplate: (id: string): boolean => {
        const storedData = localStorage.getItem(KEYS.PROPOSAL_TEMPLATES)
        const templates: ProposalTemplate[] = storedData ? JSON.parse(storedData) : []
        const filtered = templates.filter(t => t.id !== id)
        if (filtered.length === templates.length) return false
        localStorage.setItem(KEYS.PROPOSAL_TEMPLATES, JSON.stringify(filtered))
        return true
    },

    // Initialize default template for tenant
    initializeDefaultTemplate: (tenantId: string, tenantName: string, primaryColor: string): ProposalTemplate => {
        const existing = MockDB.getDefaultTemplate(tenantId)
        if (existing) return existing

        return MockDB.createProposalTemplate(tenantId, {
            name: 'Template Padrão',
            isDefault: true,
            introductionText: `Prezado(a) Cliente,\n\nÉ com grande satisfação que apresentamos esta proposta comercial. Nosso compromisso é oferecer soluções de qualidade que atendam às suas necessidades.`,
            scopeText: `Esta proposta contempla os seguintes produtos e serviços conforme especificado na tabela abaixo.`,
            paymentTerms: `• Entrada: 50% na aprovação\n• Saldo: 50% na entrega\n• Formas de pagamento: PIX, boleto ou cartão`,
            warrantyText: `Todos os produtos possuem garantia conforme especificação do fabricante. Instalações possuem garantia de 90 dias.`,
            footerText: `Agradecemos a oportunidade e ficamos à disposição para esclarecer quaisquer dúvidas.\n\nAtenciosamente,\nEquipe ${tenantName}`,
            theme: 'modern',
            primaryColor: primaryColor,
            fontFamily: "'Inter', sans-serif"
        })
    }
}
