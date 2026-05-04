import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import {
  type InventoryDefinition,
  formatInventoryValue,
  parseInventoryValue,
} from "@/lib/niches/config";
import { Loader } from "@/components/ui/loader";

interface InventoryEditableCellProps {
  initialValue: number;
  onUpdate: (newValue: string) => Promise<boolean>;
  inventory: InventoryDefinition;
  className?: string;
}

export function InventoryEditableCell({
  initialValue,
  onUpdate,
  inventory,
  className,
}: InventoryEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(String(initialValue));
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(String(initialValue));
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (value === String(initialValue)) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const success = await onUpdate(value);
      if (success) {
        setIsEditing(false);
      } else {
        setValue(String(initialValue));
      }
    } catch (error) {
      console.error("Failed to update inventory value:", error);
      setValue(String(initialValue));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setValue(String(initialValue));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing || isLoading) {
    return (
      <div className={cn("relative flex items-center w-fit", className)}>
        <Input
          ref={inputRef}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          min="0"
          step={inventory.step}
          className="h-8 w-24 text-center pr-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {isLoading && (
          <div className="absolute right-[-24px]">
            <Loader size="sm" />
          </div>
        )}
      </div>
    );
  }

  const parsedValue = parseInventoryValue(value);
  const isLowValue = parsedValue < inventory.lowValueThreshold;
  const isZeroValue = parsedValue === 0;

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors min-w-12 w-fit text-center select-none flex items-center justify-between gap-2 group",
        isZeroValue
          ? "text-destructive font-bold"
          : isLowValue
            ? "text-orange-500 font-medium"
            : "text-muted-foreground",
        className,
      )}
      title={`Clique para editar ${inventory.readOnlyLabel.toLowerCase()}`}
    >
      <span>{formatInventoryValue(parsedValue, inventory)}</span>
      <Pencil className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export const StockEditableCell = InventoryEditableCell;
