"use client";

import * as React from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Option, OptionService } from "@/services/option-service";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "@/lib/toast";
import { OptionManagerDialog } from "./option-manager-dialog";

interface DynamicSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  storageKey: string;
  label: string;
  defaultOptions?: { id: string; label: string }[];
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
  const [isManagerOpen, setIsManagerOpen] = React.useState(false);

  // Stabilize defaultOptions to prevent infinite re-fetching
  // Stabilize defaultOptions to prevent infinite re-fetching
  const defaultOptionsJson = JSON.stringify(defaultOptions);
  const stableDefaultOptions = React.useMemo(() => {
    return JSON.parse(defaultOptionsJson) as typeof defaultOptions;
  }, [defaultOptionsJson]);

  const { tenant } = useTenant();

  // Load from Firestore
  const loadOptions = React.useCallback(async () => {
    if (!tenant) return;
    try {
      const data = await OptionService.getOptions(tenant.id, storageKey);
      if (data.length > 0) {
        setOptions(data);
      } else {
        const defaults: Option[] = stableDefaultOptions.map((opt) => ({
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
      toast.error("Erro ao carregar opções.");
    }
  }, [tenant, storageKey, stableDefaultOptions]);

  React.useEffect(() => {
    if (tenant) {
      loadOptions();
    }
  }, [tenant, loadOptions]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
        >
          <Settings className="w-3 h-3 mr-1" /> Gerenciar
        </Button>
      </div>

      <SearchableSelect
        options={options.map((opt) => ({
          value: opt.label,
          label: opt.label,
        }))}
        value={typeof props.value === "string" ? props.value : ""}
        onValueChange={(val) => {
          const event = {
            target: { value: val, name: props.name ?? "" },
          } as React.ChangeEvent<HTMLSelectElement>;
          props.onChange?.(event);
        }}
        placeholder="Selecione..."
        searchPlaceholder={`Buscar ${label.toLowerCase()}...`}
        disabled={props.disabled}
        name={props.name}
        id={props.id}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <OptionManagerDialog
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onOptionsChange={loadOptions}
        storageKey={storageKey}
        label={label}
      />
    </div>
  );
}
