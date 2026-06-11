"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LiaInputBarProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  isAtLimit: boolean;
  resetDate: string;
}

// 6 linhas de 24px (leading-6) + padding vertical (8px * 2)
const MAX_TEXTAREA_HEIGHT = 6 * 24 + 16;

export function LiaInputBar({
  onSend,
  isStreaming,
  isAtLimit,
  resetDate,
}: LiaInputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const disabled = isStreaming || isAtLimit;

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Auto-resize: expande com o conteúdo até 6 linhas, só então mostra scroll
  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  const isBlocked = disabled || !value.trim();

  const sendButton = (
    <button
      type="button"
      onClick={handleSend}
      aria-disabled={isBlocked}
      aria-label="Enviar mensagem"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        "bg-primary text-primary-foreground",
        "transition-all duration-200 ease-out",
        "hover:bg-primary/90 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
        isBlocked && "cursor-not-allowed opacity-40 hover:bg-primary active:scale-100",
      )}
    >
      <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 py-3">
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-border/70 bg-background px-3 py-1.5",
          "shadow-sm transition-[border-color,box-shadow] duration-200 ease-out",
          "focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30",
          disabled && "opacity-70",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          aria-label="Mensagem para Lia"
          placeholder={isAtLimit ? "Limite de mensagens atingido." : "Mensagem..."}
          rows={1}
          className={cn(
            "flex-1 resize-none overflow-y-hidden bg-transparent py-2 text-sm leading-6",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus-visible:outline-none",
            "disabled:cursor-not-allowed",
          )}
        />

        <div className="py-1">
          {isAtLimit ? (
            <Tooltip content={`Limite atingido. Renova em ${resetDate}.`} side="top">
              {sendButton}
            </Tooltip>
          ) : (
            sendButton
          )}
        </div>
      </div>
    </div>
  );
}
