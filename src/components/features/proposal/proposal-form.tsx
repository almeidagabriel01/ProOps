"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { SectionBuilder } from "@/components/features/proposal/section-builder"
import { ProposalPreview } from "@/components/features/proposal/proposal-preview"
import { PdfGenerator } from "@/components/features/proposal/pdf-generator"
import { ProposalSection, ProposalStatus } from "@/types" // Keep types that are only in MockDB
import { ProposalService, Proposal } from "@/services/proposal-service" // Use Service for logic
import { useTenant } from "@/providers/tenant-provider"
import { useCreateProposal } from "@/hooks/useCreateProposal"
import { Save, ArrowLeft, Eye, Edit, Loader2 } from "lucide-react"

interface ProposalFormProps {
    proposalId?: string
}

export function ProposalForm({ proposalId }: ProposalFormProps) {
    const router = useRouter()
    const { tenant } = useTenant()
    const [isLoading, setIsLoading] = React.useState(!!proposalId)
    const [isSaving, setIsSaving] = React.useState(false)
    const [activeView, setActiveView] = React.useState<"edit" | "preview">("edit")

    const [formData, setFormData] = React.useState<Partial<Proposal>>({
        title: "",
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        validUntil: "",
        status: "draft" as ProposalStatus
    })

    const [sections, setSections] = React.useState<ProposalSection[]>([])

    // Load existing proposal if editing
    React.useEffect(() => {
        if (proposalId) {
            const fetchProposal = async () => {
                const proposal = await ProposalService.getProposalById(proposalId)
                if (proposal) {
                    setFormData({
                        title: proposal.title || "",
                        clientName: proposal.clientName || "",
                        clientEmail: proposal.clientEmail || "",
                        clientPhone: proposal.clientPhone || "",
                        validUntil: proposal.validUntil || "",
                        status: proposal.status || "draft"
                    })
                    setSections((proposal.sections as ProposalSection[]) || [])
                }
                setIsLoading(false)
            }
            fetchProposal()
        }
    }, [proposalId])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tenant) {
            alert("Erro: Nenhuma empresa selecionada!")
            return
        }

        if (!formData.title || !formData.clientName) {
            alert("Preencha o título e o nome do cliente!")
            return
        }

        setIsSaving(true)

        try {
            if (proposalId) {
                // Update existing
                await ProposalService.updateProposal(proposalId, {
                    ...formData,
                    sections,
                    status: formData.status as ProposalStatus
                })
                // alert("A edição de propostas está temporariamente desabilitada para manutenção de segurança.");
                setIsSaving(false);
                // return;
            } else {
                // Create new
                // Disabled legacy creation
                alert("A criação por este formulário antigo está desabilitada. Use o 'Nova Proposta' simplificado para garantir segurança.");
                setIsSaving(false);
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500)) // No longer needed
            router.push("/proposals")
        } catch (error) {
            console.error("Erro ao salvar proposta:", error)
            // alert("Erro ao salvar proposta")
        } finally {
            // setIsSaving(false) // Taken care of by hook state, or no-op if disabled
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
        <div className="space-y-6">
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
                            {proposalId ? "Atualize os dados da proposta" : "Crie uma nova proposta comercial"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Toggle - Mobile */}
                    <div className="flex items-center gap-1 border rounded-lg p-1 lg:hidden">
                        <Button
                            variant={activeView === "edit" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setActiveView("edit")}
                            className="gap-2"
                        >
                            <Edit className="w-4 h-4" />
                            Editar
                        </Button>
                        <Button
                            variant={activeView === "preview" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setActiveView("preview")}
                            className="gap-2"
                        >
                            <Eye className="w-4 h-4" />
                            Preview
                        </Button>
                    </div>
                    <PdfGenerator proposal={formData} sections={sections} />
                    <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Salvar
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Main Content - Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Editor */}
                <div className={`space-y-6 ${activeView === "preview" ? "hidden lg:block" : ""}`}>
                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Informações Básicas</CardTitle>
                            <CardDescription>Dados gerais da proposta</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Título da Proposta *</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder="Ex: Proposta de Automação Residencial"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="grid gap-2">
                                    <Label htmlFor="clientEmail">Email do Cliente</Label>
                                    <Input
                                        id="clientEmail"
                                        name="clientEmail"
                                        type="email"
                                        value={formData.clientEmail || ""}
                                        onChange={handleChange}
                                        placeholder="email@exemplo.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="clientPhone">Telefone do Cliente</Label>
                                    <Input
                                        id="clientPhone"
                                        name="clientPhone"
                                        value={formData.clientPhone || ""}
                                        onChange={handleChange}
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="validUntil">Válida até</Label>
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
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    id="status"
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    <option value="draft">Rascunho</option>
                                    <option value="sent">Enviada</option>
                                    <option value="approved">Aprovada</option>
                                    <option value="rejected">Rejeitada</option>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section Builder */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Conteúdo da Proposta</CardTitle>
                            <CardDescription>
                                Adicione seções para construir o corpo da proposta
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SectionBuilder sections={sections} onChange={setSections} />
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Preview */}
                <div className={`${activeView === "edit" ? "hidden lg:block" : ""}`}>
                    <div className="lg:sticky lg:top-4 lg:self-start">
                        <div className="mb-4 hidden lg:flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Preview</h2>
                            <span className="text-xs text-muted-foreground">Atualiza em tempo real</span>
                        </div>
                        <div
                            id="proposal-preview"
                            className="overflow-auto rounded-lg border shadow-sm"
                            style={{ maxHeight: 'calc(100vh - 120px)' }}
                        >
                            <ProposalPreview proposal={formData} sections={sections} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
