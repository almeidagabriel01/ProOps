import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
  blurOnChange?: boolean;
  selectClassName?: string;
  placeholder?: string;
};

// Helper utility to extract options from children
const getOptions = (children: React.ReactNode): { value: string; label: React.ReactNode }[] => {
  const options: { value: string; label: React.ReactNode }[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === "option") {
      const element = child as React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>;
      options.push({
        value: element.props.value as string,
        label: element.props.children,
      });
    }
  });
  return options;
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      wrapperClassName,
      selectClassName,
      children,
      onChange,
      value,
      placeholder = "Selecione...",
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const options = getOptions(children);

    // Inner ref for the native select if standard ref is not handled
    const innerRef = React.useRef<HTMLSelectElement>(null);
    const resolvedRef = (ref || innerRef) as React.RefObject<HTMLSelectElement | null>;

    // Close on click outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (newValue: string) => {
      // Update internal state check (if needed) but mainly fire external event
      if (resolvedRef.current) {
        resolvedRef.current.value = newValue;
        
        // Dispatch React-compatible change event
        const event = new Event('change', { bubbles: true });
        resolvedRef.current.dispatchEvent(event);
        
        // Also manually call prop if provided (for safety with controlled components)
        // Creating a synthetic-like event object
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
            type: 'change'
        } as unknown as React.ChangeEvent<HTMLSelectElement>;

        onChange?.(syntheticEvent);
      }
      setIsOpen(false);
    };

    const selectedOption = options.find(opt => String(opt.value) === String(value));

    return (
      <div 
        className={cn("relative group w-full", wrapperClassName, className)} 
        ref={containerRef}
      >
        {/* Helper Native Select - Hidden but functional for forms/refs */}
        <select
          ref={resolvedRef}
          className="sr-only"
          value={value}
          onChange={onChange}
          {...props}
          tabIndex={-1}
        >
            {children}
        </select>

        {/* Custom Trigger */}
        <div
          onClick={() => !props.disabled && setIsOpen(!isOpen)}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-xl border-2 border-border/60 bg-background px-4 py-3 text-sm text-foreground",
            "shadow-sm transition-all duration-200 ease-out cursor-pointer",
            "hover:border-primary/40 hover:shadow-md",
            isOpen && "border-primary ring-4 ring-primary/10 shadow-lg shadow-primary/10",
            props.disabled && "cursor-not-allowed opacity-50 hover:border-border/60 hover:shadow-sm",
            selectClassName
          )}
        >
          <span className={cn(!selectedOption && "text-muted-foreground")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown 
            className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-200", 
                isOpen && "rotate-180 text-primary"
            )} 
          />
        </div>

        {/* Custom Dropdown */}
        {isOpen && (
          <div className="absolute top-[calc(100%+4px)] left-0 w-full z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="max-h-[200px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              {options.length > 0 ? (
                options.map((option) => {
                    const isSelected = String(option.value) === String(value);
                    return (
                        <div
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                                "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 pl-3 pr-2 text-sm outline-none transition-colors",
                                "hover:bg-accent hover:text-accent-foreground",
                                isSelected && "bg-accent/50 font-medium text-accent-foreground"
                            )}
                        >
                            <span className="flex-1 truncate">{option.label}</span>
                            {isSelected && (
                                <Check className="h-4 w-4 text-primary ml-2" />
                            )}
                        </div>
                    );
                })
              ) : (
                <div className="p-2 text-sm text-muted-foreground text-center">
                    Sem opções
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
