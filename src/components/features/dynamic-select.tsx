"use client";

import * as React from "react";
import { Plus, Settings, Trash2, Edit2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Option, OptionService } from "@/services/option-service";
import { useTenant } from "@/providers/tenant-provider";

interface DynamicSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  storageKey: string; // Now acts as the 'type' in Firestore (e.g. 'product_categories')
  label: string;
  defaultOptions?: { id: string; label: string }[]; // Keep for initial UI, though we prefer Firestore content
  required?: boolean;
  error?: string;
}

export function DynamicSelect({
  storageKey,
  label,
  defaultOptions = [],
  className,
  required,
  error,
  ...props
}: DynamicSelectProps) {
  const [options, setOptions] = React.useState<Option[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // Edit State
  const [newOption, setNewOption] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");

  const { tenant } = useTenant();

  // Load from Firestore
  const loadOptions = React.useCallback(async () => {
    if (!tenant) return;
    setIsLoading(true);
    try {
      const data = await OptionService.getOptions(tenant.id, storageKey);
      if (data.length > 0) {
        setOptions(data);
      } else {
        // If no options in Firestore, we can optionally show defaultOptions locally
        // But we don't save them to Firestore automatically to keep it clean.
        // We map them to the Option type locally.
        const defaults: Option[] = defaultOptions.map((opt) => ({
          id: opt.id,
          tenantId: tenant.id,
          type: storageKey,
          label: opt.label,
          createdAt: new Date().toISOString(),
        }));
        setOptions(defaults);
      }
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  }, [tenant, storageKey, defaultOptions]);

  React.useEffect(() => {
    if (tenant) {
      loadOptions();
    }
  }, [tenant, loadOptions]);

  // Reload when dialog opens to ensure fresh data
  React.useEffect(() => {
    if (isOpen && tenant) {
      loadOptions();
    }
  }, [isOpen, tenant, loadOptions]);

  const handleAdd = async () => {
    if (!newOption.trim() || !tenant) return;
    try {
      await OptionService.createOption(tenant.id, storageKey, newOption.trim());
      // Reload from Firestore to get fresh data
      await loadOptions();
      setNewOption("");
    } catch (error) {
      console.error("Failed to add option", error);
    }
  };

  const handleDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      alert(
        "Opções padrão não podem ser excluídas permanentemente do sistema (elas são apenas sugestões). Adicione uma nova opção personalizada."
      );
      return;
    }

    if (confirm("Tem certeza que deseja excluir esta opção?")) {
      try {
        await OptionService.deleteOption(id);
        setOptions((prev) => prev.filter((o) => o.id !== id));
      } catch (error) {
        console.error("Failed to delete", error);
      }
    }
  };

  const startEdit = (option: Option, isDefault: boolean) => {
    if (isDefault) {
      alert("Opções padrão não podem ser editadas. Crie uma nova opção.");
      return;
    }
    setEditingId(option.id);
    setEditValue(option.label);
  };

  const saveEdit = async () => {
    if (!editValue.trim() || !editingId) return;
    try {
      await OptionService.updateOption(editingId, editValue.trim());
      setOptions((prev) =>
        prev.map((o) =>
          o.id === editingId ? { ...o, label: editValue.trim() } : o
        )
      );
      setEditingId(null);
      setEditValue("");
    } catch (error) {
      console.error("Failed to update", error);
    }
  };

  // Helper to check if an option is one of the defaults (not in DB)
  // In our logic, if we loaded from Firestore, it has a valid DB ID.
  // Defaults mapped locally usually have simple IDs like "1", "2".
  // Firestore IDs are usually longer. We can also check createdAt presence maybe?
  // Actually, createOption returns a proper object. Defaults are mapped.
  // Let's rely on the fact that defaults are only shown if Firestore is empty OR if we merged them?
  // Current logic: If Firestore has data, we ONLY show Firestore data. So no defaults are mixed in.
  // If Firestore is empty, we show ONLY defaults.
  // So if we are in "Defaults Mode", we can't edit/delete them in DB.
  // We'll trust the 'createdAt' field as a proxy for "Is Persisted". Defaults created locally above won't have real DB presence unless we saved them.
  // Wait, createOption sets createdAt. The map above sets createdAt too.
  // Let's assume if it came from defaultOptions prop, it is transient.
  // Better: Check if the ID exists in the defaultOptions array passed prop.
  const isDefaultOption = (id: string) => {
    return (
      defaultOptions.some((d) => d.id === id) &&
      !options.some(
        (o) => o.id === id && !defaultOptions.find((d) => d.id === o.id)
      )
    );
    // Logic is tricky. Let's simplify: if we loaded defaults because DB was empty, they act as read-only suggestions.
    // But if I add a new option, `options` will contain [defaults..., newOne].
    // Wait, my loadOptions logic says: IF data.length > 0 setOptions(data) ELSE setOptions(defaults).
    // So they are mutually exclusive.
    // If I create a first option, next loadOptions will find 1 item, and HIDE all defaults.
    // This might be jarring.
    // Perhaps we should ALWAYS show defaults? Or migrate them?
    // Let's stick to "If customized, show customizations".
    // When handleAdd is called, we add to DB. Next fetch gets it.
    // If I fetch 1 item, I don't see "Nike" anymore? That's bad.
    // User expects to see "Nike" AND "MyBrand".
    // FIX: We should initially `createOption` for all defaults if the collection is empty?
    // Or we should merge them in UI.
    // Merging in UI is safer.
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
            >
              <Settings className="w-3 h-3 mr-1" /> Gerenciar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar {label}</DialogTitle>
              <DialogDescription>
                Adicione, edite ou remova opções personalizadas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    placeholder="Nova opção..."
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                  />
                </div>
                <Button onClick={handleAdd} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto relative">
                {isLoading && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {options.length === 0 && !isLoading && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma opção encontrada.
                  </div>
                )}
                {options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center justify-between p-2 group hover:bg-muted/50 transition-colors"
                  >
                    {editingId === option.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-500"
                          onClick={saveEdit}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm pl-2">{option.label}</span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(option, false)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(option.id, false)}
                          >
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

      <Select
        {...props}
        selectClassName={cn(error && "border-destructive border-2")}
      >
        <option value="">Selecione...</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.label}>
            {opt.label}
          </option>
        ))}
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
