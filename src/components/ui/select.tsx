"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Size variant: sm = h-9 (compact), md = h-12 (default for forms) */
  inputSize?: "sm" | "md";
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      children,
      onChange,
      value,
      placeholder,
      disabled,
      error,
      inputSize = "md",
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const portalContentRef = React.useRef<HTMLDivElement>(null);
    const [isMounted, setIsMounted] = React.useState(false);
    const [fixedCoords, setFixedCoords] = React.useState({
      top: 0,
      left: 0,
      width: 0,
    });

    // Inner ref for the native select
    const innerRef = React.useRef<HTMLSelectElement>(null);
    const resolvedRef = (ref ||
      innerRef) as React.RefObject<HTMLSelectElement | null>;

    React.useEffect(() => {
      setIsMounted(true);
    }, []);

    // Extract options from children (if provided as options)
    const options = React.useMemo(() => {
      const opts: { value: string; label: React.ReactNode }[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === "option") {
          const element = child as React.ReactElement<{
            value: string;
            children: React.ReactNode;
          }>;
          opts.push({
            value: element.props.value,
            label: element.props.children,
          });
        }
      });
      return opts;
    }, [children]);

    const handleOpen = (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault(); // Prevent focus issues

      if (isOpen) {
        setIsOpen(false);
        return;
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setFixedCoords({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
        setIsOpen(true);
      }
    };

    const handleSelect = (newValue: string) => {
      if (resolvedRef.current) {
        resolvedRef.current.value = newValue;

        // Dispatch synthetic change event for React Hook Form / Standard handlers
        const event = new Event("change", { bubbles: true });
        resolvedRef.current.dispatchEvent(event);

        const syntheticEvent = {
          target: resolvedRef.current,
          currentTarget: resolvedRef.current,
          bubbles: true,
          cancelable: false,
          defaultPrevented: false,
          eventPhase: 3,
          isTrusted: true,
          nativeEvent: event as Event,
          preventDefault: () => {},
          isDefaultPrevented: () => false,
          stopPropagation: () => {},
          isPropagationStopped: () => false,
          persist: () => {},
          type: "change",
        } as unknown as React.ChangeEvent<HTMLSelectElement>;

        onChange?.(syntheticEvent);
      }
      setIsOpen(false);
    };

    // Close on click outside (using mousedown to catch it before focus trap)
    React.useEffect(() => {
      const handleGlobalMouseDown = (event: MouseEvent) => {
        if (!isOpen) return;

        // Ignore if clicking inside the trigger
        if (
          containerRef.current &&
          containerRef.current.contains(event.target as Node)
        ) {
          return;
        }
        // Ignore if clicking inside the portal
        if (
          portalContentRef.current &&
          portalContentRef.current.contains(event.target as Node)
        ) {
          return;
        }

        setIsOpen(false);
      };

      if (isOpen) {
        window.addEventListener("mousedown", handleGlobalMouseDown);
      }
      return () => {
        window.removeEventListener("mousedown", handleGlobalMouseDown);
      };
    }, [isOpen]);

    const selectedOption = options.find(
      (opt) => String(opt.value) === String(value),
    );

    const renderPortal = () => {
      if (!isOpen || !isMounted || typeof document === "undefined") return null;

      return createPortal(
        <div
          ref={portalContentRef}
          style={{
            position: "fixed",
            top: fixedCoords.top,
            left: fixedCoords.left,
            width: fixedCoords.width,
            zIndex: 99999,
            pointerEvents: "auto", // Explicitly allow events
          }}
          className="overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in duration-100"
        >
          <div className="max-h-[250px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {options.length > 0 ? (
              options.map((option) => (
                <div
                  key={option.value}
                  onMouseDown={(e) => {
                    // Critical: Use onMouseDown and preventDefault to bypass Focus traps in Dialogs
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.value);
                  }}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 pl-3 pr-2 text-sm outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    String(value) === String(option.value) &&
                      "bg-accent/50 font-medium",
                  )}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {String(value) === String(option.value) && (
                    <Check className="h-4 w-4 ml-2 text-primary shrink-0" />
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground text-center">
                Sem opções
              </div>
            )}
          </div>
        </div>,
        document.body,
      );
    };

    return (
      <div className={cn("relative w-full", className)}>
        {/* Native Select (Hidden but functional) */}
        <select
          ref={resolvedRef}
          className="sr-only"
          onChange={onChange}
          value={value}
          disabled={disabled}
          {...props}
        >
          {children}
        </select>

        {/* Custom Trigger */}
        <div
          ref={containerRef}
          onMouseDown={handleOpen} // Use onMouseDown to prevent focus issues
          className={cn(
            "flex w-full items-center justify-between rounded-xl border-2 border-border/60 bg-card px-4 text-sm text-foreground",
            inputSize === "sm" ? "h-9" : "h-12",
            "shadow-sm transition-all duration-200 ease-out cursor-pointer",
            "hover:border-primary/50 hover:bg-accent/5",
            isOpen && "border-primary ring-2 ring-primary/20",
            error && "border-destructive ring-1 ring-destructive/20",
            disabled && "cursor-not-allowed opacity-50 bg-muted",
          )}
        >
          <span
            className={cn(
              "truncate",
              !selectedOption && "text-muted-foreground",
            )}
          >
            {selectedOption
              ? selectedOption.label
              : placeholder || "Selecione..."}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 opacity-50 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>

        {/* Portal Options */}
        {renderPortal()}
      </div>
    );
  },
);
Select.displayName = "Select";
