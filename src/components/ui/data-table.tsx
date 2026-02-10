"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  /** Unique identifier for the column */
  key: string;
  /** Header label text */
  header: string;
  /** Extra classes for both header cell and content cell (e.g. "text-right") */
  className?: string;
  /** Extra classes only for the header cell */
  headerClassName?: string;
  /** Render function for the cell content */
  render: (item: T) => React.ReactNode;
  /** Whether the column is sortable (default: true) */
  sortable?: boolean;
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Data items to render as rows */
  data: T[];
  /** Extract a unique key for each item */
  keyExtractor: (item: T) => string;
  /**
   * Tailwind grid columns class for responsive layouts.
   * Example: "grid-cols-4 min-[1401px]:grid-cols-6"
   * Any valid Tailwind "grid-cols-*" class.
   * If not provided, defaults to equal columns based on columns.length using inline styles (not responsive).
   */
  gridClassName?: string;
  /** Callback for sorting */
  onSort?: (key: string) => void;
  /** Current sort configuration */
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  gridClassName,
  onSort,
  sortConfig,
}: DataTableProps<T>) {
  const colCount = columns.length;
  // If no class provided, use inline style for equal columns as fallback
  const style = gridClassName
    ? undefined
    : { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` };

  return (
    <div className="grid gap-4">
      {/* Header — border-transparent matches the Card 1px border for alignment */}
      <div
        className={cn(
          "grid gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border border-transparent",
          gridClassName,
        )}
        style={style}
      >
        {columns.map((col) => {
          const isSortable = col.sortable !== false;
          const isSorted = sortConfig?.key === col.key;
          const direction = isSorted ? sortConfig?.direction : null;

          return (
            <div
              key={col.key}
              className={cn(
                col.className,
                col.headerClassName,
                isSortable &&
                  "cursor-pointer select-none hover:text-foreground",
                "flex items-center gap-1",
              )}
              onClick={() => isSortable && onSort && onSort(col.key)}
            >
              {col.header}
              {isSortable && onSort && (
                <span className="text-muted-foreground/50">
                  {direction === "asc" ? (
                    <ArrowUp className="w-3 h-3 text-foreground" />
                  ) : direction === "desc" ? (
                    <ArrowDown className="w-3 h-3 text-foreground" />
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 opacity-50" />
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Rows */}
      {data.map((item) => (
        <Card
          key={keyExtractor(item)}
          className="hover:bg-muted/50 transition-colors"
        >
          <CardContent
            className={cn("grid gap-4 items-center py-4 px-4", gridClassName)}
            style={style}
          >
            {columns.map((col) => (
              <div key={col.key} className={cn(col.className)}>
                {col.render(item)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
