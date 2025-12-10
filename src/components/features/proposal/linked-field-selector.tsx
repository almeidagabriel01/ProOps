"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MockDB, CustomFieldType, CustomFieldItem } from "@/lib/mock-db"
import { useTenant } from "@/providers/tenant-provider"
import { ChevronDown, ChevronUp, Plus, X, Settings2 } from "lucide-react"
import Link from "next/link"

interface LinkedFieldEntry {
    id: string
    parentItemId: string
    childItemIds: string[]
}

interface LinkedFieldSelectorProps {
    parentTypeId: string
    childTypeId: string
    entries: LinkedFieldEntry[]
    onUpdate: (entries: LinkedFieldEntry[]) => void
}

export function LinkedFieldSelector({
    parentTypeId,
    childTypeId,
    entries,
    onUpdate
}: LinkedFieldSelectorProps) {
    const { tenant } = useTenant()
    const [parentType, setParentType] = React.useState<CustomFieldType | null>(null)
    const [childType, setChildType] = React.useState<CustomFieldType | null>(null)
    const [expandedEntries, setExpandedEntries] = React.useState<Set<string>>(new Set())

    React.useEffect(() => {
        if (parentTypeId) {
            setParentType(MockDB.getCustomFieldTypeById(parentTypeId) || null)
        }
        if (childTypeId) {
            setChildType(MockDB.getCustomFieldTypeById(childTypeId) || null)
        }
    }, [parentTypeId, childTypeId])

    if (!parentType || !childType) {
        return (
            <div className="text-center py-6 text-muted-foreground">
                <p className="mb-2">Configure os campos vinculados primeiro.</p>
                <Link href="/admin/custom-fields">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Settings2 className="w-4 h-4" />
                        Configurar Campos
                    </Button>
                </Link>
            </div>
        )
    }

    const addEntry = () => {
        const newEntry: LinkedFieldEntry = {
            id: crypto.randomUUID(),
            parentItemId: "",
            childItemIds: []
        }
        onUpdate([...entries, newEntry])
        setExpandedEntries(prev => new Set(prev).add(newEntry.id))
    }

    const removeEntry = (id: string) => {
        onUpdate(entries.filter(e => e.id !== id))
    }

    const updateParentItem = (entryId: string, parentItemId: string) => {
        onUpdate(entries.map(e =>
            e.id === entryId
                ? { ...e, parentItemId, childItemIds: [] }
                : e
        ))
    }

    const toggleChildItem = (entryId: string, childItemId: string) => {
        onUpdate(entries.map(e => {
            if (e.id !== entryId) return e
            const isSelected = e.childItemIds.includes(childItemId)
            return {
                ...e,
                childItemIds: isSelected
                    ? e.childItemIds.filter(id => id !== childItemId)
                    : [...e.childItemIds, childItemId]
            }
        }))
    }

    const toggleExpanded = (id: string) => {
        setExpandedEntries(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Get child items that are linked to a specific parent item
    const getChildItemsForParent = (parentItemId: string): CustomFieldItem[] => {
        if (!childType) return []
        return childType.items.filter(item =>
            !item.parentItemIds ||
            item.parentItemIds.length === 0 ||
            item.parentItemIds.includes(parentItemId)
        )
    }

    const getParentItem = (id: string) => parentType?.items.find(i => i.id === id)
    const getChildItem = (id: string) => childType?.items.find(i => i.id === id)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                    {parentType.name} → {childType.name}
                </Label>
            </div>

            {entries.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground mb-3">
                        Nenhum {parentType.name.toLowerCase()} adicionado
                    </p>
                    <Button variant="outline" onClick={addEntry} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Adicionar {parentType.name}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {entries.map(entry => {
                        const parentItem = getParentItem(entry.parentItemId)
                        const isExpanded = expandedEntries.has(entry.id)
                        const availableChildren = getChildItemsForParent(entry.parentItemId)

                        return (
                            <Card key={entry.id} className="overflow-hidden">
                                {/* Header */}
                                <div
                                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => entry.parentItemId && toggleExpanded(entry.id)}
                                >
                                    {entry.parentItemId && (
                                        isExpanded
                                            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    )}

                                    {parentItem?.image && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={parentItem.image}
                                            alt={parentItem.label}
                                            className="w-10 h-10 rounded-lg object-cover"
                                        />
                                    )}

                                    <div className="flex-1" onClick={e => e.stopPropagation()}>
                                        <select
                                            value={entry.parentItemId}
                                            onChange={(e) => updateParentItem(entry.id, e.target.value)}
                                            className="w-full bg-transparent border-0 font-medium focus:ring-0 text-foreground p-0"
                                        >
                                            <option value="">Selecione {parentType.name}...</option>
                                            {parentType.items.map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {entry.parentItemId && (
                                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                            {entry.childItemIds.length} {childType.name.toLowerCase()}(s)
                                        </span>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            removeEntry(entry.id)
                                        }}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Child Items Selection */}
                                {isExpanded && entry.parentItemId && (
                                    <CardContent className="pt-0 pb-4 border-t bg-muted/30">
                                        <Label className="text-xs text-muted-foreground mb-3 block">
                                            Selecione {childType.name.toLowerCase()}s para {parentItem?.label}:
                                        </Label>

                                        {availableChildren.length === 0 ? (
                                            <p className="text-sm text-muted-foreground italic">
                                                Nenhum {childType.name.toLowerCase()} disponível para este {parentType.name.toLowerCase()}.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                                {availableChildren.map(item => {
                                                    const isSelected = entry.childItemIds.includes(item.id)
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => toggleChildItem(entry.id, item.id)}
                                                            className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${isSelected
                                                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                                                : 'border-border hover:border-primary/50 bg-background'
                                                                }`}
                                                        >
                                                            {item.image && (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={item.image}
                                                                    alt={item.label}
                                                                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                                                                />
                                                            )}
                                                            <span className="text-xs font-medium truncate">
                                                                {item.label}
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                )}
                            </Card>
                        )
                    })}

                    <Button variant="outline" onClick={addEntry} className="w-full gap-2 mt-2">
                        <Plus className="w-4 h-4" />
                        Adicionar {parentType.name}
                    </Button>
                </div>
            )}
        </div>
    )
}

// Compact version for the proposal form
interface LinkedFieldsConfigProps {
    value: {
        parentTypeId: string
        childTypeId: string
        entries: LinkedFieldEntry[]
    }
    onChange: (value: LinkedFieldsConfigProps['value']) => void
}

export function LinkedFieldsConfig({ value, onChange }: LinkedFieldsConfigProps) {
    const { tenant } = useTenant()
    const [fieldTypes, setFieldTypes] = React.useState<CustomFieldType[]>([])

    React.useEffect(() => {
        if (tenant) {
            setFieldTypes(MockDB.getCustomFieldTypes(tenant.id))
        }
    }, [tenant])

    // Filter to show only parent types (no parentTypeId) and child types
    const parentTypes = fieldTypes.filter(t => !t.parentTypeId)
    const childTypes = fieldTypes.filter(t => t.parentTypeId === value.parentTypeId)

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Campo Principal</Label>
                    <select
                        value={value.parentTypeId}
                        onChange={(e) => onChange({
                            ...value,
                            parentTypeId: e.target.value,
                            childTypeId: "",
                            entries: []
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        <option value="">Selecione...</option>
                        {parentTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <Label>Campo Vinculado</Label>
                    <select
                        value={value.childTypeId}
                        onChange={(e) => onChange({
                            ...value,
                            childTypeId: e.target.value
                        })}
                        disabled={!value.parentTypeId}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                    >
                        <option value="">Selecione...</option>
                        {childTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {value.parentTypeId && value.childTypeId && (
                <LinkedFieldSelector
                    parentTypeId={value.parentTypeId}
                    childTypeId={value.childTypeId}
                    entries={value.entries}
                    onUpdate={(entries) => onChange({ ...value, entries })}
                />
            )}
        </div>
    )
}
