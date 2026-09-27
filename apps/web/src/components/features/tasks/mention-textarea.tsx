"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { activeMentionQuery, matchPeople } from "@/lib/tasks/tasks";
import type { TaskPerson } from "@/types/task";

interface MentionTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  people: TaskPerson[];
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Campo de texto com @menção: digitar "@" abre as pessoas que podem ser
 * citadas; escolher insere "@Nome". Quem fica citado é o que continua escrito
 * (`mentionedUids`), então apagar o nome desfaz a menção.
 */
export function MentionTextarea({ id, value, onChange, people, placeholder, disabled }: MentionTextareaProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = React.useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = React.useState(0);

  const options = mention ? matchPeople(people, mention.query).slice(0, 6) : [];

  const refresh = (text: string, caret: number) => {
    setMention(activeMentionQuery(text, caret));
    setHighlight(0);
  };

  const pick = (person: TaskPerson) => {
    if (!mention) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, mention.start)}@${person.name} ${value.slice(caret)}`;
    onChange(next);
    setMention(null);
    const position = mention.start + person.name.length + 2;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(position, position);
    });
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        onChange={(event) => {
          onChange(event.target.value);
          refresh(event.target.value, event.target.selectionStart ?? event.target.value.length);
        }}
        onKeyDown={(event) => {
          if (options.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((h) => (h + 1) % options.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((h) => (h - 1 + options.length) % options.length);
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            pick(options[highlight]);
          } else if (event.key === "Escape") {
            setMention(null);
          }
        }}
        onBlur={() => setMention(null)}
        aria-autocomplete="list"
        aria-expanded={options.length > 0}
      />
      {options.length > 0 && (
        <ul
          role="listbox"
          aria-label="Pessoas para citar"
          className="absolute left-2 right-2 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {options.map((person, index) => (
            <li
              key={person.id}
              role="option"
              aria-selected={index === highlight}
              className={cn(
                "cursor-pointer rounded px-2 py-1.5 text-sm",
                index === highlight ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
              // mousedown, não click: o blur do campo fecharia a lista antes.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(person);
              }}
            >
              {person.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
