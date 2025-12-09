"use client"

import * as React from "react"
import { Plus, Settings, Trash2, Edit2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Option {
    id: string
    label: string
}

interface DynamicSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    storageKey: string
    label: string
    defaultOptions?: Option[]
}

export function DynamicSelect({
    storageKey,
    label,
    defaultOptions = [],
    className,
    ...props
}: DynamicSelectProps) {
    const [options, setOptions] = React.useState<Option[]>([])
    const [isOpen, setIsOpen] = React.useState(false) // Manage dialog state

    // Edit State
    const [newOption, setNewOption] = React.useState("")
    const [editingId, setEditingId] = React.useState<string | null>(null)
    const [editValue, setEditValue] = React.useState("")

    // Load from storage
    React.useEffect(() => {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
            setOptions(JSON.parse(saved))
        } else if (defaultOptions.length > 0) {
            setOptions(defaultOptions)
            localStorage.setItem(storageKey, JSON.stringify(defaultOptions))
        }
    }, [storageKey, defaultOptions])

    // Save to storage
    const saveOptions = (newOptions: Option[]) => {
        setOptions(newOptions)
        localStorage.setItem(storageKey, JSON.stringify(newOptions))
    }

    const handleAdd = () => {
        if (!newOption.trim()) return
        const newItem: Option = {
            id: crypto.randomUUID(),
            label: newOption.trim()
        }
        saveOptions([...options, newItem])
        setNewOption("")
    }

    const handleDelete = (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta opção?")) {
            saveOptions(options.filter(o => o.id !== id))
        }
    }

    const startEdit = (option: Option) => {
        setEditingId(option.id)
        setEditValue(option.label)
    }

    const saveEdit = () => {
        if (!editValue.trim() || !editingId) return
        const updated = options.map(o =>
            o.id === editingId ? { ...o, label: editValue.trim() } : o
        )
        saveOptions(updated)
        setEditingId(null)
        setEditValue("")
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-primary">
                            <Settings className="w-3 h-3 mr-1" /> Gerenciar
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Gerenciar {label}</DialogTitle>
                            <DialogDescription>
                                Adicione, edite ou remova opções para este campo.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nova opção..."
                                    value={newOption}
                                    onChange={(e) => setNewOption(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                />
                                <Button onClick={handleAdd} size="icon">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                                {options.length === 0 && (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        Nenhuma opção cadastrada.
                                    </div>
                                )}
                                {options.map((option) => (
                                    <div key={option.id} className="flex items-center justify-between p-2 group hover:bg-muted/50 transition-colors">
                                        {editingId === option.id ? (
                                            <div className="flex flex-1 items-center gap-2">
                                                <Input
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="h-8"
                                                    autoFocus
                                                />
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={saveEdit}>
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setEditingId(null)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-sm pl-2">{option.label}</span>
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => startEdit(option)}>
                                                        <Edit2 className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(option.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Select {...props}>
                <option value="">Selecione...</option>
                {options.map((opt) => (
                    <option key={opt.id} value={opt.label}>
                        {opt.label}
                    </option>
                ))}
            </Select>
        </div>
    )
}
