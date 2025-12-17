"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import {
    Bold,
    Italic,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Upload,
    ArrowUpToLine,
    ArrowDownToLine,
    GripHorizontal,
} from "lucide-react"
import { PdfSection } from "../pdf-section-editor"

const fontSizeOptions = [
    { value: '12px', label: 'Pequeno' },
    { value: '14px', label: 'Normal' },
    { value: '16px', label: 'Médio' },
    { value: '18px', label: 'Grande' },
    { value: '24px', label: 'Título' },
    { value: '32px', label: 'Destaque' },
]

interface SectionContentEditorProps {
    section: PdfSection
    primaryColor: string
    updateSection: (id: string, updates: Partial<PdfSection>) => void
    updateStyle: (id: string, styleKey: keyof PdfSection['styles'], value: string) => void
    handleImageUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * Renders the content editor for a section based on its type
 */
export function SectionContentEditor({
    section,
    primaryColor,
    updateSection,
    updateStyle,
    handleImageUpload
}: SectionContentEditorProps) {
    // Column layout control
    const renderColumnLayout = () => (
        <div className="p-3 bg-muted/30 rounded-lg space-y-2">
            <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">Largura da Coluna</Label>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant={!section.columnWidth || section.columnWidth === 100 ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                            e.stopPropagation()
                            updateSection(section.id, { columnWidth: 100 })
                        }}
                    >
                        100%
                    </Button>
                    <Button
                        type="button"
                        variant={section.columnWidth === 50 ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                            e.stopPropagation()
                            updateSection(section.id, { columnWidth: 50 })
                        }}
                    >
                        1/2
                    </Button>
                    <Button
                        type="button"
                        variant={section.columnWidth === 33 ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                            e.stopPropagation()
                            updateSection(section.id, { columnWidth: 33 })
                        }}
                    >
                        1/3
                    </Button>
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
                💡 Arraste para as laterais para dividir colunas
            </p>
        </div>
    )

    // Title editor
    const renderTitleEditor = () => (
        <div className="grid gap-2">
            <Label>Texto do Título</Label>
            <Input
                value={section.content}
                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                placeholder="Digite o título..."
            />
        </div>
    )

    // Text editor
    const renderTextEditor = () => (
        <div className="grid gap-2">
            <Label>Conteúdo</Label>
            <Textarea
                value={section.content}
                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                placeholder="Digite o texto..."
                rows={4}
            />
        </div>
    )

    // Product table placeholder
    const renderProductTableEditor = () => (
        <div className="p-4 bg-muted/40 rounded border border-dashed text-center text-sm text-muted-foreground">
            A lista de produtos será renderizada aqui automaticamente.
            Posicione esta seção onde desejar que os produtos apareçam.
        </div>
    )

    // Image editor
    const renderImageEditor = () => (
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label>Imagem</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {section.imageUrl ? (
                        <div className="space-y-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={section.imageUrl}
                                alt="Section"
                                className="max-h-48 mx-auto rounded-lg object-contain"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateSection(section.id, { imageUrl: undefined })}
                            >
                                Trocar Imagem
                            </Button>
                        </div>
                    ) : (
                        <label className="cursor-pointer block py-4">
                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Clique para upload</p>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleImageUpload(section.id, e)}
                            />
                        </label>
                    )}
                </div>
            </div>
            <div className="grid gap-2">
                <Label>Legenda (opcional)</Label>
                <Input
                    value={section.content}
                    onChange={(e) => updateSection(section.id, { content: e.target.value })}
                    placeholder="Legenda da imagem..."
                />
            </div>

            {/* Image Style Options */}
            <div className="space-y-4 pt-4 border-t">
                <Label className="text-muted-foreground">Estilo da Imagem</Label>

                {/* Image Size Slider */}
                <div className="grid gap-2" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Tamanho da Imagem</Label>
                        <span className="text-xs font-medium text-primary">
                            {section.styles.imageWidth || 100}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={section.styles.imageWidth || 100}
                        onChange={(e) => updateSection(section.id, {
                            styles: { ...section.styles, imageWidth: parseInt(e.target.value) }
                        })}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>10%</span>
                        <span>50%</span>
                        <span>100%</span>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label className="text-xs">Bordas Arredondadas</Label>
                    <Select
                        value={section.styles.imageBorderRadius || '8px'}
                        onChange={(e) => updateStyle(section.id, 'imageBorderRadius', e.target.value)}
                    >
                        <option value="0px">Sem bordas</option>
                        <option value="4px">Leve</option>
                        <option value="8px">Médio</option>
                        <option value="16px">Arredondado</option>
                        <option value="9999px">Circular</option>
                    </Select>
                </div>

                {/* Alignment controls */}
                <div className="grid gap-2">
                    <Label className="text-xs">Alinhamento</Label>
                    <div className="flex flex-wrap gap-4">
                        {/* Horizontal Image Align */}
                        <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                            <Button
                                type="button"
                                variant={section.styles.imageAlign === 'left' ? 'default' : 'ghost'}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateStyle(section.id, 'imageAlign', 'left')}
                                title="Esquerda"
                            >
                                <AlignLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={(!section.styles.imageAlign || section.styles.imageAlign === 'center') ? 'default' : 'ghost'}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateStyle(section.id, 'imageAlign', 'center')}
                                title="Centro"
                            >
                                <AlignCenter className="w-4 h-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={section.styles.imageAlign === 'right' ? 'default' : 'ghost'}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateStyle(section.id, 'imageAlign', 'right')}
                                title="Direita"
                            >
                                <AlignRight className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="w-px bg-border h-7 hidden sm:block" />

                        {/* Vertical Align */}
                        <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                            <Button
                                type="button"
                                variant={section.styles.verticalAlign === 'top' || !section.styles.verticalAlign ? 'default' : 'ghost'}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateStyle(section.id, 'verticalAlign', 'top')}
                                title="Topo"
                            >
                                <ArrowUpToLine className="w-4 h-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={section.styles.verticalAlign === 'center' ? 'default' : 'ghost'}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateStyle(section.id, 'verticalAlign', 'center')}
                                title="Centro Vertical"
                            >
                                <GripHorizontal className="w-4 h-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={section.styles.verticalAlign === 'bottom' ? 'default' : 'ghost'}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateStyle(section.id, 'verticalAlign', 'bottom')}
                                title="Base"
                            >
                                <ArrowDownToLine className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id={`border-${section.id}`}
                        checked={section.styles.imageBorder || false}
                        onChange={(e) => updateStyle(section.id, 'imageBorder', e.target.checked ? 'true' : '')}
                        className="w-4 h-4"
                    />
                    <Label htmlFor={`border-${section.id}`} className="text-sm cursor-pointer">
                        Adicionar borda na imagem
                    </Label>
                </div>
            </div>
        </div>
    )

    // Text style options (for title and text sections)
    const renderTextStyleOptions = () => (
        <div className="space-y-4 pt-4 border-t">
            <Label className="text-muted-foreground">Estilo e Formatação</Label>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label className="text-xs">Tamanho</Label>
                    <Select
                        value={section.styles.fontSize || '14px'}
                        onChange={(e) => updateStyle(section.id, 'fontSize', e.target.value)}
                    >
                        {fontSizeOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label className="text-xs">Cor do Texto</Label>
                    <div className="flex gap-2">
                        <Input
                            type="color"
                            value={section.styles.color || '#000000'}
                            onChange={(e) => updateStyle(section.id, 'color', e.target.value)}
                            className="w-12 h-9 p-1"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStyle(section.id, 'color', primaryColor)}
                        >
                            Primária
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-2">
                <Label className="text-xs">Formatação e Alinhamento</Label>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Text Style */}
                    <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                        <Button
                            variant={section.styles.fontWeight === 'bold' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateStyle(section.id, 'fontWeight',
                                section.styles.fontWeight === 'bold' ? 'normal' : 'bold'
                            )}
                            title="Negrito"
                        >
                            <Bold className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={section.styles.fontStyle === 'italic' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateStyle(section.id, 'fontStyle',
                                section.styles.fontStyle === 'italic' ? 'normal' : 'italic'
                            )}
                            title="Itálico"
                        >
                            <Italic className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="w-px bg-border h-6 hidden sm:block" />

                    {/* Horizontal Align */}
                    <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                        <Button
                            type="button"
                            variant={(!section.styles.textAlign || section.styles.textAlign === 'left') ? 'default' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateStyle(section.id, 'textAlign', 'left')}
                            title="Esquerda"
                        >
                            <AlignLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            type="button"
                            variant={section.styles.textAlign === 'center' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateStyle(section.id, 'textAlign', 'center')}
                            title="Centro"
                        >
                            <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button
                            type="button"
                            variant={section.styles.textAlign === 'right' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateStyle(section.id, 'textAlign', 'right')}
                            title="Direita"
                        >
                            <AlignRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="w-px bg-border h-6 hidden sm:block" />

                    {/* Vertical Align */}
                    <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                        <Button
                            type="button"
                            variant={section.styles.verticalAlign === 'top' || !section.styles.verticalAlign ? 'default' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateStyle(section.id, 'verticalAlign', 'top')}
                            title="Alinhamento Vertical Topo"
                        >
                            <ArrowUpToLine className="w-4 h-4" />
                        </Button>
                        <Button
                            type="button"
                            variant={section.styles.verticalAlign === 'center' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateStyle(section.id, 'verticalAlign', 'center')}
                            title="Alinhamento Vertical Centro"
                        >
                            <GripHorizontal className="w-4 h-4" />
                        </Button>
                        <Button
                            type="button"
                            variant={section.styles.verticalAlign === 'bottom' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateStyle(section.id, 'verticalAlign', 'bottom')}
                            title="Alinhamento Vertical Base"
                        >
                            <ArrowDownToLine className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-2">
                <Label className="text-xs">Cor de Fundo (opcional)</Label>
                <div className="flex gap-2">
                    <Input
                        type="color"
                        value={section.styles.backgroundColor || '#ffffff'}
                        onChange={(e) => updateStyle(section.id, 'backgroundColor', e.target.value)}
                        className="w-12 h-9 p-1"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStyle(section.id, 'backgroundColor', 'transparent')}
                    >
                        Transparente
                    </Button>
                </div>
            </div>
        </div>
    )

    return (
        <div className="space-y-4">
            {renderColumnLayout()}

            {section.type === 'title' && renderTitleEditor()}
            {section.type === 'text' && renderTextEditor()}
            {section.type === 'product-table' && renderProductTableEditor()}
            {section.type === 'image' && renderImageEditor()}

            {(section.type === 'title' || section.type === 'text') && renderTextStyleOptions()}
        </div>
    )
}
