"use client";

import { useState } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface LiaToolResultCardProps {
  toolName: string;
  result: unknown;
}

function getSummary(result: unknown): string {
  if (result === null || result === undefined) return "Concluído";
  if (typeof result === "string")
    return result.slice(0, 80) + (result.length > 80 ? "…" : "");
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    // Try common summary fields
    if (obj.message) return String(obj.message).slice(0, 80);
    if (obj.count !== undefined) return `${obj.count} registro(s)`;
    if (Array.isArray(result)) return `${result.length} registro(s)`;
  }
  return "Concluído";
}

function formatResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function LiaToolResultCard({ toolName, result }: LiaToolResultCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const summary = getSummary(result);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="mt-2 rounded-xl border border-border bg-muted/50 p-3">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <Wrench className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-xs font-semibold text-foreground truncate">
            {toolName}
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {summary}
          </span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 shrink-0 text-muted-foreground",
              "transition-transform duration-200 ease-in-out",
              isOpen && "rotate-180",
            )}
            aria-hidden
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs text-foreground whitespace-pre-wrap break-words">
            {formatResult(result)}
          </pre>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
