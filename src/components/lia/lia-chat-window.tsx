"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiaMessage } from "@/types/ai";

interface LiaChatWindowProps {
  messages: LiaMessage[];
  isStreaming: boolean;
  /** Message bubble components rendered by the parent */
  children: React.ReactNode;
}

function TypingIndicator() {
  return (
    <div
      aria-label="Lia está digitando"
      aria-live="polite"
      className="flex justify-start"
    >
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-muted">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div
      aria-label="Lia está pensando"
      aria-live="polite"
      className="flex justify-start"
    >
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-muted">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />
          <span className="text-xs text-muted-foreground animate-pulse">Pensando...</span>
        </div>
      </div>
    </div>
  );
}

export function LiaChatWindow({
  messages,
  isStreaming,
  children,
}: LiaChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversa com Lia"
      className={cn(
        "flex-1 overflow-y-auto px-4 py-4",
        "flex flex-col gap-3",
      )}
    >
      {children}

      {/* Waiting indicator: shown while no text in the bubble yet */}
      {isStreaming && !(messages.at(-1)?.isStreaming && messages.at(-1)?.content) && (
        messages.at(-1)?.isThinking ? <ThinkingIndicator /> : <TypingIndicator />
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
