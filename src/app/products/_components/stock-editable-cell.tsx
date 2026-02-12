import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, Pencil } from "lucide-react";

export function StockEditableCell({
  initialValue,
  onUpdate,
  className,
}: {
  initialValue: number;
  onUpdate: (newValue: string) => Promise<boolean>;
  className?: string;
}) {
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
        // Revert on failure
        setValue(String(initialValue));
        // Toast is likely handled by the parent/hook, but good to ensure
      }
    } catch (error) {
      console.error("Failed to update stock:", error);
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
          className="h-8 w-20 text-center pr-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {isLoading && (
          <div className="absolute right-[-24px]">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  const stockValue = parseFloat(value);
  const isLowStock = stockValue < 10;
  const isZeroStock = stockValue === 0;

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors min-w-12 w-fit text-center select-none flex items-center justify-between gap-2 group",
        isZeroStock
          ? "text-destructive font-bold"
          : isLowStock
            ? "text-orange-500 font-medium"
            : "text-muted-foreground",
        className,
      )}
      title="Clique para editar"
    >
      <span>{value}</span>
      <Pencil className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
