"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compareDisplayText } from "@/lib/sort-text";
import { normalize } from "@/utils/text";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

export type SelectOption = SearchableSelectOption;

export interface SearchableSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange"
> {
  options: SearchableSelectOption[];
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  onCreateOption?: (label: string) => Promise<string | void> | string | void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  createOptionLabel?: string;
  creatingOptionLabel?: string;
  isCreatingOption?: boolean;
}

export const SearchableSelect = React.forwardRef<
  HTMLSelectElement,
  SearchableSelectProps
>(
  (
    {
      options,
      value,
      onChange,
      onValueChange,
      onCreateOption,
      placeholder = "Selecione...",
      searchPlaceholder = "Digite para buscar...",
      emptyMessage = "Nenhuma opção disponível",
      noResultsMessage = "Nenhum resultado encontrado",
      createOptionLabel = "Cadastrar",
      creatingOptionLabel = "Cadastrando...",
      isCreatingOption = false,
      disabled,
      className,
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const innerRef = React.useRef<HTMLSelectElement>(null);
    const noopSelectChange = React.useCallback(() => {}, []);

    const resolvedRef = (ref ||
      innerRef) as React.RefObject<HTMLSelectElement | null>;

    const sortedOptions = React.useMemo(() => {
      return [...options].sort((a, b) => compareDisplayText(a.label, b.label));
    }, [options]);

    const selectedOption = React.useMemo(
      () => sortedOptions.find((opt) => String(opt.value) === String(value)),
      [sortedOptions, value],
    );

    React.useEffect(() => {
      if (!isOpen) {
        setSearchTerm(selectedOption?.label || "");
      }
    }, [selectedOption, isOpen]);

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = React.useMemo(() => {
      const term = normalize(searchTerm.trim());
      if (!term) return sortedOptions;

      return sortedOptions.filter((option) => {
        const labelMatch = normalize(option.label).includes(term);
        const descriptionMatch = option.description
          ? normalize(option.description).includes(term)
          : false;
        return labelMatch || descriptionMatch;
      });
    }, [sortedOptions, searchTerm]);

    const trimmedSearchTerm = searchTerm.trim();
    const hasExactMatch = React.useMemo(() => {
      const normalizedSearchTerm = normalize(trimmedSearchTerm);
      if (!normalizedSearchTerm) return false;

      return sortedOptions.some((option) => {
        const normalizedLabel = normalize(option.label);
        const normalizedValue = normalize(String(option.value));
        return (
          normalizedLabel === normalizedSearchTerm ||
          normalizedValue === normalizedSearchTerm
        );
      });
    }, [sortedOptions, trimmedSearchTerm]);

    const canCreateOption = Boolean(
      onCreateOption && trimmedSearchTerm && !hasExactMatch,
    );

    const emitChange = (newValue: string) => {
      if (resolvedRef.current) {
        resolvedRef.current.value = newValue;

        const nativeEvent = new Event("change", { bubbles: true });
        resolvedRef.current.dispatchEvent(nativeEvent);

        const syntheticEvent = {
          target: resolvedRef.current,
          currentTarget: resolvedRef.current,
          bubbles: true,
          cancelable: false,
          defaultPrevented: false,
          eventPhase: 3,
          isTrusted: true,
          nativeEvent,
          preventDefault: () => {},
          isDefaultPrevented: () => false,
          stopPropagation: () => {},
          isPropagationStopped: () => false,
          persist: () => {},
          type: "change",
        } as unknown as React.ChangeEvent<HTMLSelectElement>;

        onChange?.(syntheticEvent);
      }
      onValueChange?.(newValue);
    };

    const handleSelectOption = (newValue: string) => {
      emitChange(newValue);
      setIsOpen(false);
      const selected = sortedOptions.find((opt) => opt.value === newValue);
      setSearchTerm(selected?.label || "");
    };

    const handleClear = () => {
      emitChange("");
      setSearchTerm("");
      setIsOpen(true);
      inputRef.current?.focus();
    };

    const handleCreateOption = async () => {
      if (!onCreateOption || !trimmedSearchTerm || isCreatingOption) return;

      const createdValue = await onCreateOption(trimmedSearchTerm);
      if (typeof createdValue === "string" && createdValue) {
        emitChange(createdValue);
        setSearchTerm(createdValue);
      }
      setIsOpen(false);
    };

    return (
      <div ref={containerRef} className={cn("relative w-full", className)}>
        <select
          ref={resolvedRef}
          className="sr-only"
          value={value}
          onChange={onChange || noopSelectChange}
          disabled={disabled}
          {...props}
        >
          <option value="">{placeholder}</option>
          {sortedOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                canCreateOption &&
                !isCreatingOption
              ) {
                e.preventDefault();
                void handleCreateOption();
              }
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedOption ? undefined : searchPlaceholder}
            disabled={disabled}
            className={cn(
              "w-full h-12 pl-9 pr-16 rounded-xl border-2 border-border/60 bg-card text-sm shadow-sm transition-[border-color,box-shadow] duration-200 ease-out",
              "placeholder:text-muted-foreground/60 hover:border-primary/40 hover:shadow-md",
              "focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm",
            )}
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchTerm && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Limpar seleção"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => !disabled && setIsOpen((prev) => !prev)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Abrir opções"
              disabled={disabled}
            >
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
          </div>
        </div>

        {isOpen && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
            <div className="p-1">
              {canCreateOption && (
                <button
                  type="button"
                  onClick={() => void handleCreateOption()}
                  disabled={isCreatingOption}
                  className="w-full px-3 py-2 text-left text-sm rounded-sm border-b hover:bg-accent hover:text-accent-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="font-medium">
                    {isCreatingOption
                      ? creatingOptionLabel
                      : `${createOptionLabel} "${trimmedSearchTerm}"`}
                  </span>
                </button>
              )}

              {sortedOptions.length === 0 ? (
                canCreateOption ? null : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                )
              ) : filteredOptions.length === 0 ? (
                canCreateOption ? null : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {noResultsMessage}
                  </div>
                )
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = String(option.value) === String(value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelectOption(option.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                        isSelected && "bg-accent/50",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {option.label}
                        </div>
                        {option.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

SearchableSelect.displayName = "SearchableSelect";
