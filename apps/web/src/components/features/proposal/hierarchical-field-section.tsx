"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CustomFieldType, CustomFieldItem } from "@/types";
import { CustomFieldService } from "@/services/custom-field-service";
import { useTenant } from "@/providers/tenant-provider";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { CustomFieldManager } from "./custom-field-manager";
import Image from "next/image";

interface EnvironmentSystem {
  id: string;
  environmentItemId: string;
  systemItems: string[]; // IDs of selected system items
}

interface HierarchicalFieldSectionProps {
  content: {
    environmentTypeId?: string;
    systemTypeId?: string;
    entries?: EnvironmentSystem[];
  };
  onUpdate: (content: {
    environmentTypeId?: string;
    systemTypeId?: string;
    entries?: EnvironmentSystem[];
  }) => void;
}

export function HierarchicalFieldSection({
  content,
  onUpdate,
}: HierarchicalFieldSectionProps) {
  const { tenant } = useTenant();
  const [fieldTypes, setFieldTypes] = React.useState<CustomFieldType[]>([]);
  const [environmentType, setEnvironmentType] =
    React.useState<CustomFieldType | null>(null);
  const [systemType, setSystemType] = React.useState<CustomFieldType | null>(
    null,
  );
  const [expandedEntries, setExpandedEntries] = React.useState<Set<string>>(
    new Set(),
  );

  React.useEffect(() => {
    if (tenant) {
      CustomFieldService.getCustomFieldTypes(tenant.id).then(setFieldTypes);
    }
  }, [tenant]);

  React.useEffect(() => {
    if (fieldTypes.length > 0) {
      if (content.environmentTypeId) {
        setEnvironmentType(
          fieldTypes.find((t) => t.id === content.environmentTypeId) || null,
        );
      } else {
        setEnvironmentType(null);
      }
      if (content.systemTypeId) {
        // Logic for system type initialization if needed
      }
    }
  }, [tenant, content.environmentTypeId, content.systemTypeId, fieldTypes]);

  const entries = content.entries || [];

  const handleEnvironmentTypeChange = (typeId: string) => {
    const type = fieldTypes.find((t) => t.id === typeId);
    setEnvironmentType(type || null);
    onUpdate({ ...content, environmentTypeId: typeId, entries: [] });
  };

  const handleSystemTypeChange = (typeId: string) => {
    const type = fieldTypes.find((t) => t.id === typeId);
    setSystemType(type || null);
    onUpdate({ ...content, systemTypeId: typeId });
  };

  const addEntry = () => {
    if (!environmentType) return;
    const newEntry: EnvironmentSystem = {
      id: crypto.randomUUID(),
      environmentItemId: "",
      systemItems: [],
    };
    onUpdate({ ...content, entries: [...entries, newEntry] });
    setExpandedEntries((prev) => new Set(prev).add(newEntry.id));
  };

  const removeEntry = (id: string) => {
    onUpdate({ ...content, entries: entries.filter((e) => e.id !== id) });
  };

  const updateEntry = (id: string, updates: Partial<EnvironmentSystem>) => {
    onUpdate({
      ...content,
      entries: entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSystemItem = (entryId: string, itemId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    const isSelected = entry.systemItems.includes(itemId);
    const newItems = isSelected
      ? entry.systemItems.filter((i) => i !== itemId)
      : [...entry.systemItems, itemId];

    updateEntry(entryId, { systemItems: newItems });
  };

  const getEnvironmentItem = (itemId: string): CustomFieldItem | undefined => {
    return environmentType?.items.find((i) => i.id === itemId);
  };

  return (
    <div className="space-y-4">
      {/* Type Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo Principal (ex: Ambiente)</Label>
          <Select
            value={content.environmentTypeId || ""}
            onChange={(e) => handleEnvironmentTypeChange(e.target.value)}
          >
            <option value="">Selecione...</option>
            {fieldTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo Secundário (ex: Sistema)</Label>
          <Select
            value={content.systemTypeId || ""}
            onChange={(e) => handleSystemTypeChange(e.target.value)}
          >
            <option value="">Selecione...</option>
            {fieldTypes
              .filter((t) => t.id !== content.environmentTypeId)
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CustomFieldManager />
      </div>

      {/* Entries */}
      {environmentType && systemType && (
        <div className="space-y-3">
          {entries.map((entry) => {
            const envItem = getEnvironmentItem(entry.environmentItemId);
            const isExpanded = expandedEntries.has(entry.id);

            return (
              <Card key={entry.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpanded(entry.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}

                  {envItem?.image && (
                    <Image
                      src={envItem.image}
                      alt=""
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded object-cover"
                    />
                  )}

                  <div className="flex-1">
                    <Select
                      value={entry.environmentItemId}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateEntry(entry.id, {
                          environmentItemId: e.target.value,
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium"
                    >
                      <option value="">
                        Selecione {environmentType.name}...
                      </option>
                      {environmentType.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {entry.systemItems.length} {systemType.name.toLowerCase()}
                    (s)
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEntry(entry.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {isExpanded && entry.environmentItemId && (
                  <CardContent className="pt-0 pb-3 border-t bg-muted/30">
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Selecione os {systemType.name.toLowerCase()}s para{" "}
                      {envItem?.label}:
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {systemType.items.map((item) => {
                        const isSelected = entry.systemItems.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleSystemItem(entry.id, item.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-muted-foreground"
                            }`}
                          >
                            {item.image && (
                              <Image
                                src={item.image}
                                alt={item.label}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded object-cover"
                              />
                            )}
                            <span className="text-xs font-medium truncate">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          <Button variant="outline" onClick={addEntry} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Adicionar {environmentType.name}
          </Button>
        </div>
      )}

      {(!environmentType || !systemType) && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Selecione os tipos de campo principal e secundário para começar
        </p>
      )}
    </div>
  );
}
