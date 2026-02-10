"use client";

import * as React from "react";
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
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  gridClassName,
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
        {columns.map((col) => (
          <div key={col.key} className={cn(col.className, col.headerClassName)}>
            {col.header}
          </div>
        ))}
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
