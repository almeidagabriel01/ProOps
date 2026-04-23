"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LiaInputBarProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  isAtLimit: boolean;
  resetDate: string;
}

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

  // Auto-grow textarea up to 5 lines (~120px)
  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 5 * 24; // ~5 lines at 24px line height
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  const isBlocked = disabled || !value.trim();

  const sendButton = (
    <Button
      type="button"
      onClick={handleSend}
      aria-disabled={isBlocked}
      aria-label="Enviar mensagem"
      className={cn(
        "w-11 h-11 shrink-0 rounded-xl",
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90",
        "aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-primary",
      )}
      size="icon"
    >
      <SendHorizontal className="w-4 h-4" />
    </Button>
  );

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-border bg-card shrink-0">
      <Textarea
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
          "flex-1 resize-none text-sm leading-6",
          "min-h-[44px] max-h-[120px]",
          "rounded-xl border-input bg-input",
          "focus-visible:ring-1 focus-visible:ring-ring",
        )}
      />

      {isAtLimit ? (
        <Tooltip content={`Limite atingido. Renova em ${resetDate}.`} side="top">
          {sendButton}
        </Tooltip>
      ) : (
        sendButton
      )}
    </div>
  );
}
