"use client"

import * as React from "react"
import { PdfSection } from "../pdf-section-editor"

export interface UsePdfSectionEditorProps {
  sections: PdfSection[]
  onChange: (sections: PdfSection[]) => void
  primaryColor: string
}

export interface UsePdfSectionEditorReturn {
  expandedSection: string | null
  setExpandedSection: React.Dispatch<React.SetStateAction<string | null>>
  draggedId: string | null
  dragOverId: string | null
  dropPlacement: 'top' | 'bottom' | 'left' | 'right' | null
  hoveredHandleId: string | null
  setHoveredHandleId: React.Dispatch<React.SetStateAction<string | null>>
  addSection: (type: PdfSection['type']) => void
  removeSection: (id: string) => void
  moveSection: (id: string, direction: 'up' | 'down') => void
  updateSection: (id: string, updates: Partial<PdfSection>) => void
  updateStyle: (id: string, styleKey: keyof PdfSection['styles'], value: string) => void
  handleImageUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
  handleDragStart: (e: React.DragEvent, id: string) => void
  handleDragOver: (e: React.DragEvent, id: string) => void
  handleDragLeave: () => void
  handleDrop: (e: React.DragEvent, targetId: string) => void
  handleContainerDrop: (e: React.DragEvent) => void
  handleDragEnd: () => void
}

/**
 * Hook for PDF section editor state and logic
 */
export function usePdfSectionEditor({
  sections,
  onChange,
  primaryColor
}: UsePdfSectionEditorProps): UsePdfSectionEditorReturn {
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null)
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)
  const [dropPlacement, setDropPlacement] = React.useState<'top' | 'bottom' | 'left' | 'right' | null>(null)
  const [hoveredHandleId, setHoveredHandleId] = React.useState<string | null>(null)

  const healLayout = (currentSections: PdfSection[]) => {
    return currentSections.map((section, index) => {
      if (!section.columnWidth || section.columnWidth === 100) return section

      const prev = currentSections[index - 1]
      const next = currentSections[index + 1]

      const prevIsPartial = prev && prev.columnWidth && prev.columnWidth < 100
      const nextIsPartial = next && next.columnWidth && next.columnWidth < 100

      if (!prevIsPartial && !nextIsPartial) {
        return { ...section, columnWidth: 100 }
      }
      return section
    })
  }

  const addSection = (type: PdfSection['type']) => {
    if (type === 'product-table' && sections.some(s => s.type === 'product-table')) {
      alert("Já existe uma lista de produtos na proposta.")
      return
    }

    const newSection: PdfSection = {
      id: crypto.randomUUID(),
      type,
      content: type === 'title' ? 'Novo Título' : 
               type === 'text' ? 'Novo parágrafo de texto...' : 
               type === 'product-table' ? 'Lista de Produtos' : '',
      styles: {
        fontSize: type === 'title' ? '24px' : '14px',
        fontWeight: type === 'title' ? 'bold' : 'normal',
        textAlign: type === 'title' ? 'left' : 'left',
        color: type === 'title' ? primaryColor : '#374151',
        marginTop: '16px',
        marginBottom: '8px'
      }
    }
    onChange([...sections, newSection])
    setExpandedSection(newSection.id)
  }

  const removeSection = (id: string) => {
    const newSections = sections.filter(s => s.id !== id)
    onChange(healLayout(newSections))
  }

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === id)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === sections.length - 1) return

    const newSections = [...sections]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSections[index], newSections[swapIndex]] = [newSections[swapIndex], newSections[index]]
    onChange(healLayout(newSections))
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== id) {
      setDragOverId(id)

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top

      if (offsetX < rect.width * 0.3) {
        setDropPlacement('left')
      } else if (offsetX > rect.width * 0.7) {
        setDropPlacement('right')
      } else if (offsetY < rect.height * 0.5) {
        setDropPlacement('top')
      } else {
        setDropPlacement('bottom')
      }
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
    setDropPlacement(null)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedId || draggedId === targetId) return

    const draggedIndex = sections.findIndex(s => s.id === draggedId)
    const targetIndex = sections.findIndex(s => s.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const targetSection = sections[targetIndex]
    const newSections = [...sections]
    const [removed] = newSections.splice(draggedIndex, 1)

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetX = e.clientX - rect.left

    const isSideDrop = (offsetX < rect.width * 0.3) || (offsetX > rect.width * 0.7)

    if (isSideDrop) {
      removed.columnWidth = 50
      if (!targetSection.columnWidth || targetSection.columnWidth === 100) {
        const adjust = draggedIndex < targetIndex ? -1 : 0
        const actualTargetIndex = targetIndex + adjust
        if (newSections[actualTargetIndex]) {
          newSections[actualTargetIndex] = { ...newSections[actualTargetIndex], columnWidth: 50 }
        }
      } else {
        removed.columnWidth = targetSection.columnWidth
      }
    } else {
      removed.columnWidth = 100
    }

    newSections.splice(targetIndex, 0, removed)

    onChange(healLayout(newSections))
    setDraggedId(null)
    setDragOverId(null)
    setDropPlacement(null)
  }

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedId) return

    const draggedIndex = sections.findIndex(s => s.id === draggedId)
    if (draggedIndex === -1) return

    const newSections = [...sections]
    const [removed] = newSections.splice(draggedIndex, 1)

    removed.columnWidth = 100
    newSections.push(removed)

    onChange(healLayout(newSections))
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const updateSection = (id: string, updates: Partial<PdfSection>) => {
    onChange(sections.map(s =>
      s.id === id ? { ...s, ...updates } : s
    ))
  }

  const updateStyle = (id: string, styleKey: keyof PdfSection['styles'], value: string) => {
    onChange(sections.map(s =>
      s.id === id ? { ...s, styles: { ...s.styles, [styleKey]: value } } : s
    ))
  }

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 500 * 1024) {
        alert("A imagem da seção deve ter no máximo 500KB.")
        e.target.value = ""
        return
      }
      const reader = new FileReader()
      reader.onload = (event) => {
        updateSection(id, { imageUrl: event.target?.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  return {
    expandedSection,
    setExpandedSection,
    draggedId,
    dragOverId,
    dropPlacement,
    hoveredHandleId,
    setHoveredHandleId,
    addSection,
    removeSection,
    moveSection,
    updateSection,
    updateStyle,
    handleImageUpload,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleContainerDrop,
    handleDragEnd,
  }
}
