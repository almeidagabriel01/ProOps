"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiaMessage } from "@/types/ai";

interface LiaMessageBubbleProps {
  message: LiaMessage;
}

function ErrorBadge({ message }: { message: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 ml-2",
        "px-1.5 py-0.5 text-xs font-semibold rounded",
        "bg-destructive/10 text-destructive",
      )}
    >
      {message}
    </span>
  );
}

function LimitErrorCard({ message }: { message: string }) {
  return (
    <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{message}</p>
    </div>
  );
}


export function LiaMessageBubble({ message }: LiaMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "rounded-tr-sm bg-card border border-border text-foreground"
            : "rounded-tl-sm bg-muted text-foreground leading-relaxed",
        )}
      >
        {/* Message content */}
        {isUser || message.isStreaming ? (
          // User messages and streaming Lia messages: plain text
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          // Post-stream Lia messages: render with ReactMarkdown
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Inline error badge */}
        {message.error && (
          message.errorType === "limit_reached" || message.errorType === "plan_blocked" ? (
            <LimitErrorCard message={message.error} />
          ) : (
            <ErrorBadge message={message.error} />
          )
        )}

      </div>
    </div>
  );
}
