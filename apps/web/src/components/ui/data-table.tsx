"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useInfiniteScroll,
  useAsyncInfiniteScroll,
} from "@/hooks/useInfiniteScroll";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { PaginatedResult } from "@/services/client-service";
import { Loader } from "@/components/ui/loader";

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
  /**
   * Static data array (used when NOT using async pagination).
   * If `fetchPage` is provided, this prop is ignored.
   */
  data?: T[];
  /** Extract a unique key for each item */
  keyExtractor: (item: T) => string;
  /**
   * Tailwind grid columns class for responsive layouts.
   * Example: "grid-cols-4 min-[1401px]:grid-cols-6"
   */
  gridClassName?: string;
  /** Callback for sorting */
  onSort?: (key: string) => void;
  /** Current sort configuration */
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
  /** Items per batch for infinite scroll. Defaults to 15 (static) or 12 (async). */
  batchSize?: number;
  /**
   * Async pagination: a function to fetch a page of data.
   * When provided, enables cursor-based Firestore pagination.
   * `data` prop is ignored in this mode.
   */
  fetchPage?: (
    cursor: QueryDocumentSnapshot<DocumentData> | null,
  ) => Promise<PaginatedResult<T>>;
  /** Whether async fetching is enabled. Defaults to true. */
  fetchEnabled?: boolean;
  /** Exposes the reset function for async mode */
  onResetRef?: React.MutableRefObject<(() => void) | null>;
  /** Exposes items for external use (search filtering, etc.) */
  onItemsChange?: (items: T[]) => void;
  /**
   * Minimum width (CSS value) for the table content. When the
   * viewport is narrower than this, the table scrolls horizontally.
   * Example: "900px"
   */
  minWidth?: string;
  /**
   * Optional custom skeleton to show during async initial load.
   * When provided, replaces the default Loader2 spinner.
   */
  loadingSkeleton?: React.ReactNode;
  /**
   * Callback fired once when async mode finishes the first load
   * (success or failure), useful to gate parent-level rendering.
   */
  onInitialLoadComplete?: () => void;
}

// ── Internal sub-component for ASYNC mode ────────────────────────────
function AsyncDataTable<T>({
  columns,
  keyExtractor,
  gridClassName,
  onSort,
  sortConfig,
  batchSize = 12,
  fetchPage,
  fetchEnabled = true,
  onResetRef,
  onItemsChange,
  minWidth,
  loadingSkeleton,
  onInitialLoadComplete,
}: DataTableProps<T> & {
  fetchPage: NonNullable<DataTableProps<T>["fetchPage"]>;
}) {
  const { items, isLoading, hasMore, sentinelRef, reset } =
    useAsyncInfiniteScroll({
      fetchPage,
      batchSize,
      enabled: fetchEnabled,
    });
  const initialLoadNotifiedRef = React.useRef(false);

  // Expose reset function
  React.useEffect(() => {
    if (onResetRef) {
      onResetRef.current = reset;
    }
  }, [reset, onResetRef]);

  // Notify parent of items changes
  React.useEffect(() => {
    if (onItemsChange) {
      onItemsChange(items);
    }
  }, [items, onItemsChange]);

  React.useEffect(() => {
    if (!isLoading && !initialLoadNotifiedRef.current) {
      initialLoadNotifiedRef.current = true;
      onInitialLoadComplete?.();
    }
  }, [isLoading, onInitialLoadComplete]);

  const colCount = columns.length;
  const style = gridClassName
    ? undefined
    : { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` };
  const innerStyle = minWidth ? { minWidth } : undefined;

  if (isLoading) {
    if (loadingSkeleton) {
      return <>{loadingSkeleton}</>;
    }
    return (
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-4 flex-1" style={innerStyle}>
          <div
            className={cn(
              "grid gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border border-transparent",
              gridClassName,
            )}
            style={style}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className={cn(
                  col.className,
                  col.headerClassName,
                  "flex items-center gap-1 whitespace-nowrap",
                )}
              >
                {col.header}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader size="md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-4 flex-1" style={innerStyle}>
        {/* Header */}
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
                  "flex items-center gap-1 whitespace-nowrap",
                )}
              >
                {isSortable ? (
                  <button
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground focus:outline-none"
                    onClick={() => onSort && onSort(col.key)}
                  >
                    {col.header}
                    <span className="ml-1 text-muted-foreground/50">
                      {direction === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-foreground" />
                      ) : direction === "desc" ? (
                        <ArrowDown className="w-3 h-3 text-foreground" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </span>
                  </button>
                ) : (
                  col.header
                )}
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {items.map((item) => (
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

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-4"
          >
            <Loader size="md" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main DataTable (handles both static and async) ───────────────────
export function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns,
    data,
    keyExtractor,
    gridClassName,
    onSort,
    sortConfig,
    batchSize = 15,
    fetchPage,
  } = props;

  // ASYNC mode
  if (fetchPage) {
    return <AsyncDataTable {...props} fetchPage={fetchPage} />;
  }

  // STATIC mode (backwards compatible)
  const items = data ?? [];

  return (
    <StaticDataTable
      columns={columns}
      data={items}
      keyExtractor={keyExtractor}
      gridClassName={gridClassName}
      onSort={onSort}
      sortConfig={sortConfig}
      batchSize={batchSize}
      minWidth={props.minWidth}
    />
  );
}

// ── Static sub-component ─────────────────────────────────────────────
function StaticDataTable<T>({
  columns,
  data,
  keyExtractor,
  gridClassName,
  onSort,
  sortConfig,
  batchSize = 15,
  minWidth,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  gridClassName?: string;
  onSort?: (key: string) => void;
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
  batchSize?: number;
  minWidth?: string;
}) {
  const colCount = columns.length;
  const style = gridClassName
    ? undefined
    : { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` };
  const innerStyle = minWidth ? { minWidth } : undefined;

  const { displayedItems, hasMore, sentinelRef } = useInfiniteScroll(
    data,
    batchSize,
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-4 flex-1" style={innerStyle}>
        {/* Header */}
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
                  "flex items-center gap-1 whitespace-nowrap",
                )}
              >
                {isSortable ? (
                  <button
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground focus:outline-none"
                    onClick={() => onSort && onSort(col.key)}
                  >
                    {col.header}
                    <span className="ml-1 text-muted-foreground/50">
                      {direction === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-foreground" />
                      ) : direction === "desc" ? (
                        <ArrowDown className="w-3 h-3 text-foreground" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </span>
                  </button>
                ) : (
                  col.header
                )}
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {displayedItems.map((item) => (
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

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-4"
          >
            <Loader size="md" />
          </div>
        )}
      </div>
    </div>
  );
}
