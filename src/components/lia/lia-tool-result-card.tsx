"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
      <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground">
        <Wrench className="w-3 h-3 shrink-0" aria-hidden />
        <span className="font-medium text-foreground">{toolName}</span>
        <span>·</span>
        <span>{summary}</span>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="ml-1 underline underline-offset-2 hover:text-foreground transition-colors"
          >
            {isOpen ? "Recolher" : "Ver detalhes"}
          </button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-1">
        <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs text-foreground whitespace-pre-wrap break-words">
          {formatResult(result)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
