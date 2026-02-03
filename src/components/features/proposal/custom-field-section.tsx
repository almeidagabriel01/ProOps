"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CustomFieldType, CustomFieldItem } from "@/types";
import { CustomFieldService } from "@/services/custom-field-service";
import { useTenant } from "@/providers/tenant-provider";
import Image from "next/image";
import { CustomFieldManager } from "./custom-field-manager";

interface CustomFieldSectionProps {
  content: {
    fieldTypeId?: string;
    selectedItems?: string[]; // Array of item IDs
  };
  onUpdate: (content: {
    fieldTypeId?: string;
    selectedItems?: string[];
  }) => void;
}

export function CustomFieldSection({
  content,
  onUpdate,
}: CustomFieldSectionProps) {
  const { tenant } = useTenant();
  const [fieldTypes, setFieldTypes] = React.useState<CustomFieldType[]>([]);
  const [selectedType, setSelectedType] =
    React.useState<CustomFieldType | null>(null);

  React.useEffect(() => {
    if (tenant) {
      CustomFieldService.getCustomFieldTypes(tenant.id).then((types) => {
        setFieldTypes(types);
        if (content.fieldTypeId) {
          const type = types.find((t) => t.id === content.fieldTypeId);
          setSelectedType(type || null);
        }
      });
    }
  }, [tenant, content.fieldTypeId]);

  const handleTypeChange = (typeId: string) => {
    const type = fieldTypes.find((t) => t.id === typeId);
    setSelectedType(type || null);
    onUpdate({ fieldTypeId: typeId, selectedItems: [] });
  };

  const handleToggleItem = (itemId: string) => {
    const current = content.selectedItems || [];
    const isSelected = current.includes(itemId);
    const newSelected = isSelected
      ? current.filter((id) => id !== itemId)
      : [...current, itemId];
    onUpdate({ ...content, selectedItems: newSelected });
  };

  const selectedItems = content.selectedItems || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Label>Tipo de Campo</Label>
          <Select
            value={content.fieldTypeId || ""}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="">Selecione um tipo...</option>
            {fieldTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="pt-6">
          <CustomFieldManager />
        </div>
      </div>

      {selectedType && (
        <div className="space-y-2">
          <Label>Selecione os itens de {selectedType.name}:</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {selectedType.items.map((item) => {
              const isSelected = selectedItems.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleItem(item.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.label}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded object-cover"
                    />
                  )}
                  <span className="text-sm font-medium truncate">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedType.items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum item cadastrado. Use o botão &quot;Campos
              Personalizados&quot; para adicionar.
            </p>
          )}
        </div>
      )}

      {!selectedType && fieldTypes.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-2">
            Você ainda não criou nenhum tipo de campo personalizado.
          </p>
          <CustomFieldManager />
        </div>
      )}
    </div>
  );
}

interface CustomFieldPreviewProps {
  content: {
    fieldTypeId?: string;
    selectedItems?: string[];
  };
}

export function CustomFieldPreview({ content }: CustomFieldPreviewProps) {
  const [selectedType, setSelectedType] =
    React.useState<CustomFieldType | null>(null);
  const [items, setItems] = React.useState<CustomFieldItem[]>([]);

  React.useEffect(() => {
    if (content.fieldTypeId) {
      CustomFieldService.getCustomFieldTypeById(content.fieldTypeId).then(
        (type) => {
          setSelectedType(type || null);
          if (type && content.selectedItems) {
            const selectedItems = type.items.filter((i) =>
              content.selectedItems?.includes(i.id),
            );
            setItems(selectedItems);
          }
        },
      );
    }
  }, [content]);

  if (!selectedType || items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-800">{selectedType.name}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.id} className="text-center">
            {item.image && (
              <div className="relative w-full h-20 mb-1">
                <Image
                  src={item.image}
                  alt={item.label}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            )}
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
