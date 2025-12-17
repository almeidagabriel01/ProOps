"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Type, FileText, Image as ImageIcon, List } from "lucide-react"
import { PdfSection } from "../pdf-section-editor"

interface AddSectionButtonsProps {
    onAddSection: (type: PdfSection['type']) => void
}

export function AddSectionButtons({ onAddSection }: AddSectionButtonsProps) {
    return (
        <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onAddSection('title')} className="gap-2">
                <Type className="w-4 h-4" />
                Título
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAddSection('text')} className="gap-2">
                <FileText className="w-4 h-4" />
                Texto
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAddSection('image')} className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Imagem
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAddSection('divider')} className="gap-2">
                <div className="w-4 h-0.5 bg-current" />
                Divisor
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAddSection('product-table')} className="gap-2">
                <List className="w-4 h-4" />
                Lista de Produtos
            </Button>
        </div>
    )
}
