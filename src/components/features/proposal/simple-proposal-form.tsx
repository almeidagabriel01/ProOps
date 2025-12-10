"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MockDB, Proposal, Product, ProposalProduct, ProposalTemplate } from "@/lib/mock-db"
import { useTenant } from "@/providers/tenant-provider"
import {
    Save,
    ArrowLeft,
    Loader2,
    Package,
    Plus,
    Minus,
    FileDown,
    User,
    Calendar,
    Percent,
    FileText
} from "lucide-react"

interface SimpleProposalFormProps {
    proposalId?: string
}

export function SimpleProposalForm({ proposalId }: SimpleProposalFormProps) {
    const router = useRouter()
    const { tenant } = useTenant()
    const [isLoading, setIsLoading] = React.useState(!!proposalId)
    const [isSaving, setIsSaving] = React.useState(false)
    const [products, setProducts] = React.useState<Product[]>([])
    const [template, setTemplate] = React.useState<ProposalTemplate | null>(null)

    const [formData, setFormData] = React.useState<Partial<Proposal>>({
        title: "",
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        clientAddress: "",
        validUntil: "",
        customNotes: "",
        discount: 0,
        products: []
    })

    // Load products and template
    React.useEffect(() => {
        if (tenant) {
            setProducts(MockDB.getProducts(tenant.id))
            // Initialize or get default template
            const defaultTemplate = MockDB.initializeDefaultTemplate(
                tenant.id,
                tenant.name,
                tenant.primaryColor
            )
            setTemplate(defaultTemplate)
        }
    }, [tenant])

    // Load existing proposal if editing
    React.useEffect(() => {
        if (proposalId) {
            const proposal = MockDB.getProposalById(proposalId)
            if (proposal) {
                setFormData({
                    title: proposal.title,
                    clientName: proposal.clientName,
                    clientEmail: proposal.clientEmail,
                    clientPhone: proposal.clientPhone,
                    clientAddress: proposal.clientAddress,
                    validUntil: proposal.validUntil,
                    customNotes: proposal.customNotes,
                    discount: proposal.discount || 0,
                    products: proposal.products || []
                })
            }
            setIsLoading(false)
        }
    }, [proposalId])

    const selectedProducts = formData.products || []

    const toggleProduct = (product: Product) => {
        const existing = selectedProducts.find(p => p.productId === product.id)
        if (existing) {
            setFormData(prev => ({
                ...prev,
                products: selectedProducts.filter(p => p.productId !== product.id)
            }))
        } else {
            const price = parseFloat(product.price) || 0
            const newProduct: ProposalProduct = {
                productId: product.id,
                productName: product.name,
                productImage: product.image || undefined,
                productDescription: product.description || undefined,
                quantity: 1,
                unitPrice: price,
                total: price
            }
            setFormData(prev => ({
                ...prev,
                products: [...selectedProducts, newProduct]
            }))
        }
    }

    const updateProductQuantity = (productId: string, delta: number) => {
        setFormData(prev => ({
            ...prev,
            products: selectedProducts.map(p => {
                if (p.productId === productId) {
                    const newQty = Math.max(1, p.quantity + delta)
                    return { ...p, quantity: newQty, total: newQty * p.unitPrice }
                }
                return p
            })
        }))
    }

    const calculateSubtotal = () => {
        return selectedProducts.reduce((sum, p) => sum + p.total, 0)
    }

    const calculateDiscount = () => {
        return (calculateSubtotal() * (formData.discount || 0)) / 100
    }

    const calculateTotal = () => {
        return calculateSubtotal() - calculateDiscount()
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: name === 'discount' ? Number(value) : value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tenant) {
            alert("Erro: Nenhuma empresa selecionada!")
            return
        }

        if (!formData.title || !formData.clientName || selectedProducts.length === 0) {
            alert("Preencha o título, nome do cliente e selecione pelo menos um produto!")
            return
        }

        setIsSaving(true)

        try {
            if (proposalId) {
                MockDB.updateProposal(proposalId, {
                    ...formData,
                    templateId: template?.id,
                    products: selectedProducts,
                    status: 'draft'
                })
            } else {
                MockDB.createProposal(tenant.id, {
                    title: formData.title!,
                    clientName: formData.clientName!,
                    clientEmail: formData.clientEmail,
                    clientPhone: formData.clientPhone,
                    clientAddress: formData.clientAddress,
                    validUntil: formData.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'draft',
                    templateId: template?.id,
                    products: selectedProducts,
                    customNotes: formData.customNotes,
                    discount: formData.discount
                })
            }

            await new Promise(resolve => setTimeout(resolve, 300))
            router.push("/proposals")
        } catch (error) {
            console.error("Erro ao salvar proposta:", error)
            alert("Erro ao salvar proposta")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/proposals")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {proposalId ? "Editar Proposta" : "Nova Proposta"}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Preencha os dados e selecione os produtos
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Client Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Dados do Cliente
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Título da Proposta *</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder="Ex: Automação Residencial - Casa Silva"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="clientName">Nome do Cliente *</Label>
                                <Input
                                    id="clientName"
                                    name="clientName"
                                    value={formData.clientName}
                                    onChange={handleChange}
                                    placeholder="Nome completo ou empresa"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="clientEmail">Email</Label>
                                <Input
                                    id="clientEmail"
                                    name="clientEmail"
                                    type="email"
                                    value={formData.clientEmail}
                                    onChange={handleChange}
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="clientPhone">Telefone</Label>
                                <Input
                                    id="clientPhone"
                                    name="clientPhone"
                                    value={formData.clientPhone}
                                    onChange={handleChange}
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="validUntil" className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Válida até
                                </Label>
                                <Input
                                    id="validUntil"
                                    name="validUntil"
                                    type="date"
                                    value={formData.validUntil ? formData.validUntil.split("T")[0] : ""}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="clientAddress">Endereço</Label>
                            <Input
                                id="clientAddress"
                                name="clientAddress"
                                value={formData.clientAddress}
                                onChange={handleChange}
                                placeholder="Endereço completo"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Product Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Selecione os Produtos
                        </CardTitle>
                        <CardDescription>
                            Clique para adicionar produtos à proposta
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {products.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Nenhum produto cadastrado</p>
                                <Button variant="link" onClick={() => router.push("/products/new")}>
                                    Cadastrar produtos
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {products.map(product => {
                                    const selected = selectedProducts.find(p => p.productId === product.id)
                                    return (
                                        <div
                                            key={product.id}
                                            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${selected
                                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                                : 'border-border hover:border-primary/50'
                                                }`}
                                            onClick={() => toggleProduct(product)}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-medium">{product.name}</h4>
                                                <span className="text-sm font-bold text-primary">
                                                    R$ {parseFloat(product.price).toFixed(2)}
                                                </span>
                                            </div>
                                            {product.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                                    {product.description}
                                                </p>
                                            )}

                                            {selected && (
                                                <div
                                                    className="flex items-center justify-center gap-2 mt-3 pt-3 border-t"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => updateProductQuantity(product.id, -1)}
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </Button>
                                                    <span className="font-bold w-8 text-center">{selected.quantity}</span>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => updateProductQuantity(product.id, 1)}
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Summary & Notes */}
                {selectedProducts.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                Resumo da Proposta
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Selected Products Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="text-left p-3">Produto</th>
                                            <th className="text-center p-3 w-20">Qtd</th>
                                            <th className="text-right p-3 w-28">Unit.</th>
                                            <th className="text-right p-3 w-28">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedProducts.map(product => (
                                            <tr key={product.productId} className="border-t">
                                                <td className="p-3 font-medium">{product.productName}</td>
                                                <td className="p-3 text-center">{product.quantity}</td>
                                                <td className="p-3 text-right">R$ {product.unitPrice.toFixed(2)}</td>
                                                <td className="p-3 text-right font-medium">R$ {product.total.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-muted/50">
                                        <tr className="border-t">
                                            <td colSpan={3} className="p-3 text-right">Subtotal:</td>
                                            <td className="p-3 text-right font-medium">R$ {calculateSubtotal().toFixed(2)}</td>
                                        </tr>
                                        {(formData.discount || 0) > 0 && (
                                            <tr>
                                                <td colSpan={3} className="p-3 text-right text-destructive">
                                                    Desconto ({formData.discount}%):
                                                </td>
                                                <td className="p-3 text-right font-medium text-destructive">
                                                    - R$ {calculateDiscount().toFixed(2)}
                                                </td>
                                            </tr>
                                        )}
                                        <tr className="border-t-2 border-primary">
                                            <td colSpan={3} className="p-3 text-right text-lg font-bold">Total:</td>
                                            <td className="p-3 text-right text-lg font-bold text-primary">
                                                R$ {calculateTotal().toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Discount */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Percent className="w-4 h-4 text-muted-foreground" />
                                    <Label htmlFor="discount">Desconto:</Label>
                                </div>
                                <Input
                                    id="discount"
                                    name="discount"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={formData.discount || 0}
                                    onChange={handleChange}
                                    className="w-24"
                                />
                                <span className="text-muted-foreground">%</span>
                            </div>

                            {/* Custom Notes */}
                            <div className="grid gap-2">
                                <Label htmlFor="customNotes">Observações Adicionais</Label>
                                <Textarea
                                    id="customNotes"
                                    name="customNotes"
                                    value={formData.customNotes || ""}
                                    onChange={handleChange}
                                    placeholder="Notas ou condições especiais para esta proposta..."
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => router.push("/proposals")}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSaving || selectedProducts.length === 0} className="gap-2">
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Salvar Proposta
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
