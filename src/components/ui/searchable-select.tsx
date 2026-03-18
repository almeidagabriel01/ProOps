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

export interface SearchableSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  options: SearchableSelectOption[];
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
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
      placeholder = "Selecione...",
      searchPlaceholder = "Digite para buscar...",
      emptyMessage = "Nenhuma opcao disponivel",
      noResultsMessage = "Nenhum resultado encontrado",
      disabled,
      className,
      ...props
    },
    ref,
  ) => {
    const DEFAULT_DROPDOWN_MAX_HEIGHT = 288;
    const VIEWPORT_EDGE_PADDING = 12;
    const DROPDOWN_OFFSET = 4;
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [dropdownMaxHeight, setDropdownMaxHeight] = React.useState(
      DEFAULT_DROPDOWN_MAX_HEIGHT,
    );
    const containerRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const listboxRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const innerRef = React.useRef<HTMLSelectElement>(null);
    const noopSelectChange = React.useCallback(() => {}, []);
    const listboxId = React.useId();

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
      if (!isOpen) return;

      const handleInteractionOutside = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node | null;
        if (!target) return;

        if (
          containerRef.current &&
          !containerRef.current.contains(target) &&
          listboxRef.current &&
          !listboxRef.current.contains(target)
        ) {
          setIsOpen(false);
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleInteractionOutside);
      document.addEventListener("touchstart", handleInteractionOutside, {
        passive: true,
      });
      document.addEventListener("keydown", handleEscape);

      return () =>
      {
        document.removeEventListener("mousedown", handleInteractionOutside);
        document.removeEventListener("touchstart", handleInteractionOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [isOpen]);

    const updateDropdownMaxHeight = React.useCallback(() => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBottom =
        viewportTop + viewportHeight - VIEWPORT_EDGE_PADDING;
      const availableBelow = Math.max(
        0,
        Math.floor(viewportBottom - triggerRect.bottom - DROPDOWN_OFFSET),
      );

      setDropdownMaxHeight(
        Math.min(DEFAULT_DROPDOWN_MAX_HEIGHT, availableBelow),
      );
    }, []);

    React.useLayoutEffect(() => {
      if (!isOpen) return;

      updateDropdownMaxHeight();

      const handleViewportChange = () => {
        updateDropdownMaxHeight();
      };

      window.addEventListener("resize", handleViewportChange);
      window.addEventListener("scroll", handleViewportChange, true);
      window.visualViewport?.addEventListener("resize", handleViewportChange);
      window.visualViewport?.addEventListener("scroll", handleViewportChange);

      return () => {
        window.removeEventListener("resize", handleViewportChange);
        window.removeEventListener("scroll", handleViewportChange, true);
        window.visualViewport?.removeEventListener(
          "resize",
          handleViewportChange,
        );
        window.visualViewport?.removeEventListener(
          "scroll",
          handleViewportChange,
        );
      };
    }, [isOpen, updateDropdownMaxHeight]);

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

    return (
      <div
        ref={containerRef}
        className={cn("relative w-full overflow-visible", className)}
      >
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

        <div ref={triggerRef} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedOption ? undefined : searchPlaceholder}
            disabled={disabled}
            className={cn(
              "h-12 w-full rounded-xl border-2 border-border/60 bg-card pl-9 pr-16 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 ease-out",
              "placeholder:text-muted-foreground/60 hover:border-primary/40 hover:shadow-md",
              "focus:border-primary focus:shadow-lg focus:shadow-primary/10 focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm",
            )}
          />

          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {searchTerm && !disabled ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Limpar selecao"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => !disabled && setIsOpen((prev) => !prev)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Abrir opcoes"
              disabled={disabled}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
          </div>
        </div>

        {isOpen && !disabled ? (
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-[120] mt-1 overflow-y-auto overscroll-contain rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]"
            style={{
              maxHeight: `${dropdownMaxHeight}px`,
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
            }}
          >
            {sortedOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {noResultsMessage}
              </div>
            ) : (
              <div className="p-1.5">
                {filteredOptions.map((option) => {
                  const isSelected = String(option.value) === String(value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => handleSelectOption(option.value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/60",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {option.label}
                        </div>
                        {option.description ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {option.description}
                          </div>
                        ) : null}
                      </div>
                      {isSelected ? (
                        <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  },
);

SearchableSelect.displayName = "SearchableSelect";
