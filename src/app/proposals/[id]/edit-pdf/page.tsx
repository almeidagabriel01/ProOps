"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MockDB, Proposal, ProposalTemplate } from "@/lib/mock-db"
import { useTenant } from "@/providers/tenant-provider"
import { PdfSectionEditor, PdfSection, createDefaultSections } from "@/components/features/proposal/pdf-section-editor"
import {
    ArrowLeft,
    FileDown,
    Save,
    Loader2,
    Palette,
    ZoomIn,
    ZoomOut,
    Layout,
    FileText,
    Upload
} from "lucide-react"

const fontOptions = [
    { value: "'Inter', sans-serif", label: "Inter (Moderna)" },
    { value: "'Playfair Display', serif", label: "Playfair Display (Elegante)" },
    { value: "Georgia, serif", label: "Georgia (Clássica)" },
    { value: "'Roboto', sans-serif", label: "Roboto (Clean)" },
    { value: "'Lato', sans-serif", label: "Lato (Profissional)" },
    { value: "'Montserrat', sans-serif", label: "Montserrat (Moderna)" },
]

const themeOptions = [
    { value: "modern", label: "Moderno", description: "Gradientes vibrantes", preview: "bg-gradient-to-br from-blue-600 to-blue-800" },
    { value: "classic", label: "Clássico", description: "Elegante e formal", preview: "bg-white border-2" },
    { value: "minimal", label: "Minimalista", description: "Limpo e direto", preview: "bg-gray-50" },
    { value: "tech", label: "Tech", description: "Futurista e dark", preview: "bg-gradient-to-b from-gray-900 to-gray-800" },
    { value: "elegant", label: "Elegante", description: "Premium dourado", preview: "bg-gradient-to-br from-gray-900 to-gray-700" },
    { value: "bold", label: "Impactante", description: "Cores vibrantes", preview: "bg-gradient-to-br from-purple-600 to-pink-600" },
]

type ThemeType = 'modern' | 'classic' | 'minimal' | 'tech' | 'elegant' | 'bold'

export default function EditPdfPage() {
    const params = useParams()
    const router = useRouter()
    const { tenant } = useTenant()
    const proposalId = params.id as string

    const [proposal, setProposal] = React.useState<Proposal | null>(null)
    const [template, setTemplate] = React.useState<ProposalTemplate | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [isSaving, setIsSaving] = React.useState(false)
    const [isGenerating, setIsGenerating] = React.useState(false)

    // Cover settings
    const [coverTitle, setCoverTitle] = React.useState("")
    const [coverImage, setCoverImage] = React.useState<string>("")
    const [theme, setTheme] = React.useState<ThemeType>('modern')

    // Style settings
    const [primaryColor, setPrimaryColor] = React.useState("#2563eb")
    const [fontFamily, setFontFamily] = React.useState("'Inter', sans-serif")

    // Editable sections
    const [sections, setSections] = React.useState<PdfSection[]>([])

    // Preview zoom
    const [previewZoom, setPreviewZoom] = React.useState(0.5)

    React.useEffect(() => {
        if (proposalId && tenant) {
            const p = MockDB.getProposalById(proposalId)
            if (p) {
                setProposal(p)
                const t = p.templateId
                    ? MockDB.getProposalTemplateById(p.templateId)
                    : MockDB.initializeDefaultTemplate(tenant.id, tenant.name, tenant.primaryColor)

                if (t) {
                    setTemplate(t)
                    setCoverTitle(p.title || "")
                    setPrimaryColor(t.primaryColor)
                    setFontFamily(t.fontFamily)
                    setTheme(t.theme as ThemeType)
                    if (t.coverImage) setCoverImage(t.coverImage)

                    // Create default sections from template
                    setSections(createDefaultSections(t, t.primaryColor))
                }
            }
            setIsLoading(false)
        }
    }, [proposalId, tenant])

    const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                setCoverImage(event.target?.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSave = async () => {
        if (!proposal || !template) return
        setIsSaving(true)

        try {
            MockDB.updateProposalTemplate(template.id, {
                primaryColor,
                fontFamily,
                theme,
                coverImage
            })

            MockDB.updateProposal(proposal.id, {
                title: coverTitle
            })

            await new Promise(r => setTimeout(r, 300))
            alert("Alterações salvas!")
        } catch (error) {
            console.error(error)
            alert("Erro ao salvar")
        } finally {
            setIsSaving(false)
        }
    }

    const handleGeneratePdf = async () => {
        setIsGenerating(true)
        try {
            const html2canvas = (await import("html2canvas")).default
            const jsPDF = (await import("jspdf")).default

            const previewElement = document.getElementById("pdf-preview-content")
            if (!previewElement) {
                alert("Erro: Preview não encontrado")
                return
            }

            const canvas = await html2canvas(previewElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
                onclone: (clonedDoc) => {
                    const allElements = clonedDoc.querySelectorAll('*')
                    allElements.forEach((el) => {
                        const element = el as HTMLElement
                        const cs = window.getComputedStyle(element)
                        if (cs.backgroundColor.includes('lab') || cs.backgroundColor.includes('oklab')) {
                            element.style.backgroundColor = '#ffffff'
                        }
                        if (cs.color.includes('lab') || cs.color.includes('oklab')) {
                            element.style.color = '#000000'
                        }
                    })
                }
            })

            const pdf = new jsPDF("p", "mm", "a4")
            const pageWidth = 210
            const pageHeight = 297
            const imgWidth = pageWidth
            const imgHeight = (canvas.height * imgWidth) / canvas.width
            let heightLeft = imgHeight
            let position = 0

            pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, position, imgWidth, imgHeight)
            heightLeft -= pageHeight

            while (heightLeft > 0) {
                position = heightLeft - imgHeight
                pdf.addPage()
                pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, position, imgWidth, imgHeight)
                heightLeft -= pageHeight
            }

            pdf.save(`proposta-${proposal?.title?.toLowerCase().replace(/\s+/g, "-") || "comercial"}.pdf`)
        } catch (error) {
            console.error(error)
            alert("Erro ao gerar PDF")
        } finally {
            setIsGenerating(false)
        }
    }

    // Adjust color helper
    const adjustColor = (hex: string, percent: number): string => {
        const num = parseInt(hex.replace("#", ""), 16)
        const amt = Math.round(2.55 * percent)
        const R = Math.min(255, Math.max(0, (num >> 16) + amt))
        const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt))
        const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt))
        return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    }

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!proposal || !template) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Proposta não encontrada</p>
                <Button variant="link" onClick={() => router.push("/proposals")}>
                    Voltar para propostas
                </Button>
            </div>
        )
    }

    const products = proposal.products || []
    const subtotal = products.reduce((sum, p) => sum + p.total, 0)
    const discountAmt = (subtotal * (proposal.discount || 0)) / 100
    const total = subtotal - discountAmt

    // Render Cover Page based on theme
    const renderCoverPage = () => {
        const coverStyle: React.CSSProperties = {
            minHeight: '297mm',
            padding: '48px',
            fontFamily,
            position: 'relative',
            overflow: 'hidden'
        }

        switch (theme) {
            case 'modern':
                return (
                    <div style={{
                        ...coverStyle,
                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`
                    }}>
                        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white opacity-20" />
                        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full bg-white opacity-10" />
                        {coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImage} alt="" className="absolute bottom-0 right-0 w-1/2 h-1/2 object-cover opacity-30" />
                        )}
                        <div className="relative z-10 flex flex-col h-full text-white">
                            <div className="text-2xl font-bold">{tenant?.name}</div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-lg uppercase tracking-[0.2em] opacity-80 mb-4">Proposta Comercial</div>
                                <div className="text-5xl font-bold leading-tight mb-6">{coverTitle}</div>
                                <div className="w-24 h-1 bg-white/60 mb-8" />
                                <div className="text-xl opacity-90">
                                    Preparada para<br />
                                    <span className="text-2xl font-semibold">{proposal.clientName}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 'tech':
                return (
                    <div style={{
                        ...coverStyle,
                        background: `linear-gradient(180deg, #0a0a0a 0%, ${primaryColor}20 100%)`
                    }}>
                        <div className="absolute inset-0 opacity-20" style={{
                            backgroundImage: `linear-gradient(${primaryColor}20 1px, transparent 1px), linear-gradient(90deg, ${primaryColor}20 1px, transparent 1px)`,
                            backgroundSize: '40px 40px'
                        }} />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-30" style={{ backgroundColor: primaryColor }} />
                        {coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImage} alt="" className="absolute bottom-0 right-0 w-1/3 object-cover opacity-20" />
                        )}
                        <div className="relative z-10 flex flex-col h-full text-white">
                            <div className="flex items-center gap-3">
                                <span className="text-xl font-bold">{tenant?.name}</span>
                                <div className="flex-1 h-px" style={{ backgroundColor: primaryColor }} />
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-sm uppercase tracking-[0.3em] opacity-60 mb-4" style={{ color: primaryColor }}>Proposta Comercial</div>
                                <div className="text-5xl font-bold mb-4">{coverTitle}</div>
                                <div className="text-lg opacity-70">Preparada para {proposal.clientName}</div>
                            </div>
                        </div>
                    </div>
                )
            case 'elegant':
                return (
                    <div style={{
                        ...coverStyle,
                        background: 'linear-gradient(to bottom right, #111827, #374151, #111827)'
                    }}>
                        <div className="absolute inset-8 border-2 rounded-lg" style={{ borderColor: '#D4AF37' }} />
                        {coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImage} alt="" className="absolute inset-12 object-cover opacity-10 rounded-lg" />
                        )}
                        <div className="relative z-10 flex flex-col h-full items-center justify-center text-center text-white">
                            <div className="w-24 h-0.5 mb-6" style={{ backgroundColor: '#D4AF37' }} />
                            <div className="text-sm uppercase tracking-[0.4em] mb-4" style={{ color: '#D4AF37' }}>Proposta Comercial</div>
                            <div className="text-4xl font-serif font-bold mb-6" style={{ color: '#D4AF37' }}>{coverTitle}</div>
                            <div className="w-16 h-0.5 mb-6" style={{ backgroundColor: '#D4AF37' }} />
                            <div className="text-lg opacity-80">
                                Exclusivamente para<br />
                                <span className="text-xl font-semibold" style={{ color: '#D4AF37' }}>{proposal.clientName}</span>
                            </div>
                        </div>
                    </div>
                )
            case 'bold':
                return (
                    <div style={{ ...coverStyle, backgroundColor: primaryColor }}>
                        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-black opacity-10" />
                        <div className="absolute top-1/4 right-1/4 w-32 h-32 border-4 border-white opacity-20 rotate-45" />
                        {coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImage} alt="" className="absolute bottom-0 left-0 w-2/3 h-1/2 object-cover opacity-30" />
                        )}
                        <div className="relative z-10 flex flex-col h-full text-white">
                            <div className="text-2xl font-black">{tenant?.name}</div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-7xl font-black leading-none mb-4">{coverTitle}</div>
                                <div className="text-xl font-semibold opacity-90 border-l-4 border-white pl-4">{proposal.clientName}</div>
                            </div>
                        </div>
                    </div>
                )
            case 'classic':
                return (
                    <div style={{ ...coverStyle, background: 'white' }}>
                        <div className="h-2 w-full mb-8" style={{ backgroundColor: primaryColor }} />
                        {coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImage} alt="" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md opacity-10" />
                        )}
                        <div className="relative z-10 flex flex-col h-full justify-center items-center text-center">
                            <div className="border-t-2 border-b-2 py-8 px-12" style={{ borderColor: primaryColor }}>
                                <div className="text-lg uppercase tracking-[0.3em] text-gray-500 mb-4">Proposta Comercial</div>
                                <div className="text-4xl font-serif font-bold text-gray-900">{coverTitle}</div>
                            </div>
                            <div className="mt-12">
                                <div className="text-lg text-gray-600 mb-2">Apresentada a</div>
                                <div className="text-2xl font-semibold text-gray-900">{proposal.clientName}</div>
                            </div>
                        </div>
                    </div>
                )
            default: // minimal
                return (
                    <div style={{ ...coverStyle, background: '#f9fafb' }}>
                        {coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImage} alt="" className="absolute top-1/4 right-12 max-w-xs opacity-20" />
                        )}
                        <div className="relative z-10 flex flex-col h-full items-center justify-center text-center">
                            <div className="text-5xl font-light tracking-tight mb-4" style={{ color: primaryColor }}>Proposta Comercial</div>
                            <div className="text-2xl text-gray-800 font-semibold mb-8">{coverTitle}</div>
                            <div className="w-24 h-1 mx-auto mb-8" style={{ backgroundColor: primaryColor }} />
                            <div className="text-lg text-gray-600">
                                Para: <span className="font-semibold text-gray-800">{proposal.clientName}</span>
                            </div>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/proposals/${proposalId}/view`)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Editor de PDF</h1>
                        <p className="text-muted-foreground text-sm">Personalize completamente sua proposta</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </Button>
                    <Button onClick={handleGeneratePdf} disabled={isGenerating} className="gap-2">
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        Baixar PDF
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Editor Panel */}
                <div className="space-y-4">
                    <Tabs defaultValue="content">
                        <TabsList className="grid grid-cols-3 w-full">
                            <TabsTrigger value="cover" className="gap-1">
                                <Layout className="w-4 h-4" />
                                Capa
                            </TabsTrigger>
                            <TabsTrigger value="content" className="gap-1">
                                <FileText className="w-4 h-4" />
                                Conteúdo
                            </TabsTrigger>
                            <TabsTrigger value="style" className="gap-1">
                                <Palette className="w-4 h-4" />
                                Estilo
                            </TabsTrigger>
                        </TabsList>

                        {/* Cover Tab */}
                        <TabsContent value="cover" className="space-y-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Capa da Proposta</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label>Título Principal</Label>
                                        <Input
                                            value={coverTitle}
                                            onChange={(e) => setCoverTitle(e.target.value)}
                                            placeholder="Título da proposta"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Imagem de Capa (aparece como fundo)</Label>
                                        <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                            {coverImage ? (
                                                <div className="space-y-3">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={coverImage} alt="Capa" className="max-h-32 mx-auto rounded-lg object-contain" />
                                                    <Button variant="outline" size="sm" onClick={() => setCoverImage("")}>Remover</Button>
                                                </div>
                                            ) : (
                                                <label className="cursor-pointer block py-4">
                                                    <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                                                    <p className="text-sm text-muted-foreground">Clique para upload</p>
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverImageUpload} />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Tema da Capa</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {themeOptions.map(t => (
                                                <button
                                                    key={t.value}
                                                    type="button"
                                                    onClick={() => setTheme(t.value as ThemeType)}
                                                    className={`p-3 rounded-lg border-2 text-left transition-all ${theme === t.value ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                                                        }`}
                                                >
                                                    <div className={`w-full h-8 rounded mb-2 ${t.preview}`} style={
                                                        t.value === 'classic' ? { borderColor: primaryColor } : undefined
                                                    } />
                                                    <div className="font-medium text-sm">{t.label}</div>
                                                    <div className="text-xs text-muted-foreground">{t.description}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Content Tab */}
                        <TabsContent value="content" className="space-y-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Seções do Documento</CardTitle>
                                    <p className="text-sm text-muted-foreground">Adicione, remova e personalize as seções</p>
                                </CardHeader>
                                <CardContent>
                                    <PdfSectionEditor
                                        sections={sections}
                                        onChange={setSections}
                                        primaryColor={primaryColor}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Style Tab */}
                        <TabsContent value="style" className="space-y-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Cores e Fontes Globais</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label>Cor Principal</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                                className="w-14 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Fonte Principal</Label>
                                        <Select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                                            {fontOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div className="p-4 rounded-lg bg-muted" style={{ fontFamily }}>
                                        <div className="text-lg font-bold mb-2" style={{ color: primaryColor }}>Prévia do Estilo</div>
                                        <p className="text-sm text-muted-foreground">Este é um exemplo de como o texto aparecerá.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Preview Panel */}
                <div className="lg:sticky lg:top-4 lg:self-start">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Preview em tempo real</CardTitle>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPreviewZoom(z => Math.max(0.2, z - 0.1))}
                                        title="Diminuir zoom"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </Button>
                                    <span className="text-xs text-muted-foreground w-12 text-center">
                                        {Math.round(previewZoom * 100)}%
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPreviewZoom(z => Math.min(1, z + 0.1))}
                                        title="Aumentar zoom"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-hidden rounded-b-lg">
                            <div className="max-h-[75vh] overflow-auto bg-gray-200 p-4">
                                <div
                                    id="pdf-preview-content"
                                    className="w-[210mm] mx-auto shadow-2xl origin-top transition-transform"
                                    style={{
                                        transform: `scale(${previewZoom})`,
                                        marginBottom: `${-100 + previewZoom * 100}%`,
                                        fontFamily
                                    }}
                                >
                                    {/* Cover Page */}
                                    {renderCoverPage()}

                                    {/* Content Pages */}
                                    <div className="bg-white p-12 space-y-4" style={{ fontFamily }}>
                                        {/* Header */}
                                        <div className="flex items-start justify-between border-b-2 pb-6" style={{ borderColor: primaryColor }}>
                                            <div className="text-2xl font-bold" style={{ color: primaryColor }}>{tenant?.name}</div>
                                            <div className="text-right text-sm text-gray-600">
                                                <div className="font-semibold text-lg text-gray-900">{coverTitle}</div>
                                                <div>{proposal.clientName}</div>
                                            </div>
                                        </div>

                                        {/* Custom Sections with Multi-Column Support */}
                                        <div className="flex flex-wrap">
                                            {sections.map(section => (
                                                <div
                                                    key={section.id}
                                                    style={{
                                                        width: `${section.columnWidth || 100}%`,
                                                        padding: section.columnWidth && section.columnWidth < 100 ? '0 8px' : undefined,
                                                        boxSizing: 'border-box',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: section.styles.verticalAlign === 'center' ? 'center' :
                                                            section.styles.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: section.styles.fontSize,
                                                            fontWeight: section.styles.fontWeight,
                                                            fontStyle: section.styles.fontStyle,
                                                            textAlign: section.styles.textAlign,
                                                            color: section.styles.color,
                                                            backgroundColor: section.styles.backgroundColor === 'transparent' ? undefined : section.styles.backgroundColor,
                                                            padding: section.styles.backgroundColor && section.styles.backgroundColor !== 'transparent' ? '12px' : undefined,
                                                            borderRadius: section.styles.backgroundColor && section.styles.backgroundColor !== 'transparent' ? '8px' : undefined,
                                                            marginTop: section.styles.marginTop,
                                                            marginBottom: section.styles.marginBottom,
                                                        }}
                                                    >
                                                        {section.type === 'divider' ? (
                                                            <hr style={{ borderColor: primaryColor, borderTop: '2px solid' }} />
                                                        ) : section.type === 'image' ? (
                                                            <div
                                                                style={{
                                                                    textAlign: section.styles.imageAlign || 'center'
                                                                }}
                                                            >
                                                                {section.imageUrl && (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img
                                                                        src={section.imageUrl}
                                                                        alt=""
                                                                        style={{
                                                                            width: `${section.styles.imageWidth || 100}%`,
                                                                            maxWidth: '100%',
                                                                            borderRadius: section.styles.imageBorderRadius || '8px',
                                                                            border: section.styles.imageBorder ? '2px solid #e5e7eb' : 'none',
                                                                            display: 'inline-block'
                                                                        }}
                                                                    />
                                                                )}
                                                                {section.content && <p className="text-sm text-gray-500 mt-2">{section.content}</p>}
                                                            </div>
                                                        ) : (
                                                            section.content.split('\n').map((line, i) => (
                                                                <React.Fragment key={i}>
                                                                    {line}
                                                                    {i < section.content.split('\n').length - 1 && <br />}
                                                                </React.Fragment>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Products */}
                                        {products.length > 0 && (
                                            <div>
                                                <h2 className="text-xl font-bold mb-4 pb-2 border-b-2" style={{ borderColor: primaryColor, color: primaryColor }}>
                                                    Produtos e Serviços
                                                </h2>
                                                <div className="space-y-3">
                                                    {products.map((product, i) => (
                                                        <div key={product.productId} className={`flex gap-4 p-4 rounded-lg border ${i % 2 === 0 ? 'bg-gray-50' : ''}`}>
                                                            {product.productImage && (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={product.productImage} alt="" className="w-16 h-16 rounded object-cover" />
                                                            )}
                                                            <div className="flex-1">
                                                                <div className="font-semibold">{product.productName}</div>
                                                                {product.productDescription && <p className="text-sm text-gray-500">{product.productDescription}</p>}
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm text-gray-500">{product.quantity}x {formatCurrency(product.unitPrice)}</div>
                                                                <div className="font-bold" style={{ color: primaryColor }}>{formatCurrency(product.total)}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-4 pt-4 border-t-2 flex justify-end" style={{ borderColor: primaryColor }}>
                                                    <div className="w-48 space-y-1 text-right">
                                                        <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
                                                        {proposal.discount && proposal.discount > 0 && (
                                                            <div className="flex justify-between text-red-600"><span>Desconto:</span><span>-{formatCurrency(discountAmt)}</span></div>
                                                        )}
                                                        <div className="flex justify-between text-xl font-bold pt-2 border-t" style={{ color: primaryColor }}>
                                                            <span>Total:</span><span>{formatCurrency(total)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
