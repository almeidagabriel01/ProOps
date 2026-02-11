"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  children: React.ReactNode;
}

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: (node: HTMLDivElement | null) => void;
}>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  contentRef: () => {},
});

export function useDropdownMenuContext() {
  return React.useContext(DropdownMenuContext);
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const portalContentRef = React.useRef<HTMLDivElement>(null);
  const handleContentRef = React.useCallback((node: HTMLDivElement | null) => {
    portalContentRef.current = node;
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsidePortal = portalContentRef.current?.contains(target);
      if (!isInsideContainer && !isInsidePortal) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider
      value={{
        open,
        setOpen,
        triggerRef: containerRef,
        contentRef: handleContentRef,
      }}
    >
      <div className="relative inline-block text-left mt-1" ref={containerRef}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { open, setOpen } = React.useContext(DropdownMenuContext);

  if (asChild) {
    // Clone element to attach onClick and data-state
    const child = React.Children.only(children) as React.ReactElement<{
      onClick?: React.MouseEventHandler;
      "data-state"?: string;
    }>;
    return React.cloneElement(child, {
      "data-state": open ? "open" : "closed",
      onClick: (e: React.MouseEvent) => {
        // Determine if we should stop prop? maybe
        if (child.props && typeof child.props.onClick === "function") {
          child.props.onClick(e);
        }
        setOpen(!open);
      },
    });
  }

  return (
    <button
      onClick={() => setOpen(!open)}
      data-state={open ? "open" : "closed"}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  className,
  align = "center",
  side = "bottom",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  forceMount?: boolean;
}) {
  const { open, triggerRef, contentRef } =
    React.useContext(DropdownMenuContext);
  const localRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number }>(
    { top: 0, left: 0 },
  );

  React.useEffect(() => {
    if (!open || !triggerRef?.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const contentEl = localRef.current;
    const contentWidth = contentEl?.offsetWidth || 200;

    let top = 0;
    let left = 0;

    // Side positioning
    if (side === "bottom") {
      top = rect.bottom + 8;
    } else if (side === "top") {
      top = rect.top - 8 - (contentEl?.offsetHeight || 0);
    }

    // Align positioning
    if (align === "end") {
      left = rect.right - contentWidth;
    } else if (align === "start") {
      left = rect.left;
    } else {
      left = rect.left + rect.width / 2 - contentWidth / 2;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - contentWidth - 8));

    setPosition({ top, left });
  }, [open, align, side, triggerRef]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      ref={(el) => {
        (localRef as React.MutableRefObject<HTMLDivElement | null>).current =
          el;
        contentRef(el);
      }}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      className={cn(
        "min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DropdownMenuItem({
  children,
  className,
  onClick,
  disabled,
  preventClose,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  preventClose?: boolean;
}) {
  const { setOpen } = React.useContext(DropdownMenuContext);

  return (
    <div
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        if (!preventClose) {
          setOpen(false);
        }
      }}
      data-disabled={disabled ? "" : undefined}
    >
      {children}
    </div>
  );
}

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />;
}
