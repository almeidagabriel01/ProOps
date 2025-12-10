"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProposalPdfSettings, Proposal, ProposalSection } from "@/lib/mock-db"
import { useTenant } from "@/providers/tenant-provider"
import { Download, FileDown, Loader2, Palette, Layout, Type as TypeIcon } from "lucide-react"
import { PdfCoverPage } from "./pdf-cover-page"

interface PdfGeneratorProps {
    proposal: Partial<Proposal>
    sections: ProposalSection[]
}

const fontOptions = [
    { value: "'Inter', sans-serif", label: "Inter (Moderna)" },
    { value: "'Playfair Display', serif", label: "Playfair Display (Elegante)" },
    { value: "Georgia, serif", label: "Georgia (Clássica)" },
    { value: "'Roboto', sans-serif", label: "Roboto (Clean)" },
    { value: "'Lato', sans-serif", label: "Lato (Profissional)" },
    { value: "Arial, sans-serif", label: "Arial (Simples)" },
]

const themeOptions = [
    { value: "modern", label: "Moderno", description: "Gradientes e visual arrojado" },
    { value: "classic", label: "Clássico", description: "Elegante e tradicional" },
    { value: "minimal", label: "Minimalista", description: "Limpo e direto" },
]

export function PdfGenerator({ proposal, sections }: PdfGeneratorProps) {
    const { tenant } = useTenant()
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [isOpen, setIsOpen] = React.useState(false)
    const [includeCover, setIncludeCover] = React.useState(true)
    const [coverTheme, setCoverTheme] = React.useState<'modern' | 'classic' | 'minimal'>('modern')
    const [settings, setSettings] = React.useState<ProposalPdfSettings>({
        primaryColor: tenant?.primaryColor || "#2563eb",
        secondaryColor: "#64748b",
        fontFamily: "'Inter', sans-serif",
        includeLogo: true,
        includeHeader: true,
        includeFooter: true,
        margins: "normal"
    })

    const handleGenerate = async () => {
        setIsGenerating(true)

        try {
            const html2canvas = (await import("html2canvas")).default
            const jsPDF = (await import("jspdf")).default

            const pdf = new jsPDF("p", "mm", "a4")
            const pageWidth = 210
            const pageHeight = 297

            // Helper function to render element to PDF
            const renderElementToPdf = async (elementId: string, addPage: boolean = true) => {
                const element = document.getElementById(elementId)
                if (!element) return false

                if (addPage) pdf.addPage()

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff",
                    onclone: (clonedDoc) => {
                        const allElements = clonedDoc.querySelectorAll('*')
                        allElements.forEach((el) => {
                            const element = el as HTMLElement
                            const computedStyle = window.getComputedStyle(element)
                            if (computedStyle.backgroundColor.includes('lab') ||
                                computedStyle.backgroundColor.includes('oklab')) {
                                element.style.backgroundColor = '#ffffff'
                            }
                            if (computedStyle.color.includes('lab') ||
                                computedStyle.color.includes('oklab')) {
                                element.style.color = '#000000'
                            }
                        })
                    }
                })

                const imgWidth = pageWidth
                const imgHeight = (canvas.height * imgWidth) / canvas.width

                pdf.addImage(
                    canvas.toDataURL("image/jpeg", 0.95),
                    "JPEG",
                    0,
                    0,
                    imgWidth,
                    Math.min(imgHeight, pageHeight)
                )

                return true
            }

            // Generate cover page if enabled
            if (includeCover) {
                const coverElement = document.getElementById("pdf-cover-page")
                if (coverElement) {
                    const canvas = await html2canvas(coverElement, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: null,
                        onclone: (clonedDoc) => {
                            const allElements = clonedDoc.querySelectorAll('*')
                            allElements.forEach((el) => {
                                const element = el as HTMLElement
                                const computedStyle = window.getComputedStyle(element)
                                if (computedStyle.backgroundColor.includes('lab')) {
                                    element.style.backgroundColor = 'transparent'
                                }
                            })
                        }
                    })

                    pdf.addImage(
                        canvas.toDataURL("image/jpeg", 0.95),
                        "JPEG",
                        0,
                        0,
                        pageWidth,
                        pageHeight
                    )
                }
            }

            // Generate content pages
            const previewElement = document.getElementById("proposal-preview")
            if (previewElement) {
                const originalStyle = previewElement.style.cssText
                previewElement.style.width = "210mm"
                previewElement.style.fontFamily = settings.fontFamily

                const canvas = await html2canvas(previewElement, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff",
                    onclone: (clonedDoc) => {
                        const allElements = clonedDoc.querySelectorAll('*')
                        allElements.forEach((el) => {
                            const element = el as HTMLElement
                            const computedStyle = window.getComputedStyle(element)
                            if (computedStyle.backgroundColor.includes('lab') ||
                                computedStyle.backgroundColor.includes('oklab') ||
                                computedStyle.backgroundColor.includes('lch')) {
                                element.style.backgroundColor = '#ffffff'
                            }
                            if (computedStyle.color.includes('lab') ||
                                computedStyle.color.includes('oklab') ||
                                computedStyle.color.includes('lch')) {
                                element.style.color = '#000000'
                            }
                            if (computedStyle.borderColor.includes('lab') ||
                                computedStyle.borderColor.includes('oklab') ||
                                computedStyle.borderColor.includes('lch')) {
                                element.style.borderColor = '#cccccc'
                            }
                        })
                    }
                })

                previewElement.style.cssText = originalStyle

                const imgWidth = pageWidth
                const imgHeight = (canvas.height * imgWidth) / canvas.width
                let heightLeft = imgHeight
                let position = 0

                // Add first content page
                if (includeCover) pdf.addPage()
                pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, position, imgWidth, imgHeight)
                heightLeft -= pageHeight

                // Add remaining pages
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight
                    pdf.addPage()
                    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, position, imgWidth, imgHeight)
                    heightLeft -= pageHeight
                }
            }

            // Download
            const filename = `proposta-${proposal.title?.toLowerCase().replace(/\s+/g, "-") || "comercial"}.pdf`
            pdf.save(filename)
            setIsOpen(false)
        } catch (error) {
            console.error("Erro ao gerar PDF:", error)
            alert("Erro ao gerar PDF. Verifique o console para mais detalhes.")
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <>
            {/* Hidden Cover Page for PDF generation */}
            {includeCover && (
                <div className="fixed -left-[9999px] top-0">
                    <div id="pdf-cover-page" className="w-[210mm] h-[297mm]">
                        <PdfCoverPage
                            proposal={proposal}
                            theme={coverTheme}
                        />
                    </div>
                </div>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button className="gap-2">
                        <FileDown className="w-4 h-4" />
                        Gerar PDF
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Configurações do PDF</DialogTitle>
                        <DialogDescription>
                            Personalize sua proposta antes de gerar
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="appearance" className="mt-4">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="appearance" className="gap-2">
                                <Palette className="w-4 h-4" />
                                Aparência
                            </TabsTrigger>
                            <TabsTrigger value="cover" className="gap-2">
                                <Layout className="w-4 h-4" />
                                Capa
                            </TabsTrigger>
                            <TabsTrigger value="typography" className="gap-2">
                                <TypeIcon className="w-4 h-4" />
                                Tipografia
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="appearance" className="space-y-4 pt-4">
                            {/* Primary Color */}
                            <div className="grid gap-2">
                                <Label>Cor Principal</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={settings.primaryColor}
                                        onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                                        className="w-14 h-10 p-1 cursor-pointer"
                                    />
                                    <Input
                                        value={settings.primaryColor}
                                        onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                                        className="flex-1"
                                    />
                                </div>
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.includeLogo}
                                        onChange={(e) => setSettings(s => ({ ...s, includeLogo: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Incluir logo da empresa</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.includeHeader}
                                        onChange={(e) => setSettings(s => ({ ...s, includeHeader: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Incluir cabeçalho</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.includeFooter}
                                        onChange={(e) => setSettings(s => ({ ...s, includeFooter: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Incluir rodapé</span>
                                </label>
                            </div>
                        </TabsContent>

                        <TabsContent value="cover" className="space-y-4 pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeCover}
                                    onChange={(e) => setIncludeCover(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm font-medium">Incluir página de capa</span>
                            </label>

                            {includeCover && (
                                <div className="space-y-3">
                                    <Label>Estilo da Capa</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {themeOptions.map(theme => (
                                            <button
                                                key={theme.value}
                                                type="button"
                                                onClick={() => setCoverTheme(theme.value as typeof coverTheme)}
                                                className={`p-3 rounded-lg border-2 text-left transition-all ${coverTheme === theme.value
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border hover:border-muted-foreground'
                                                    }`}
                                            >
                                                <div className="font-medium text-sm">{theme.label}</div>
                                                <div className="text-xs text-muted-foreground">{theme.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="typography" className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label>Fonte Principal</Label>
                                <Select
                                    value={settings.fontFamily}
                                    onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                                >
                                    {fontOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Select>
                            </div>

                            <div className="p-4 bg-muted rounded-lg" style={{ fontFamily: settings.fontFamily }}>
                                <div className="text-lg font-bold mb-2">Prévia da Fonte</div>
                                <div className="text-sm text-muted-foreground">
                                    ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
                                    abcdefghijklmnopqrstuvwxyz<br />
                                    0123456789
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Gerando...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Baixar PDF
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
