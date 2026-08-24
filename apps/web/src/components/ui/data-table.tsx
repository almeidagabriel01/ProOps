"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  useInfiniteScroll,
  useAsyncInfiniteScroll,
} from "@/hooks/useInfiniteScroll";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { PaginatedResult } from "@/services/client-service";
import { Loader } from "@/components/ui/loader";

/**
 * Where a column lands when the table collapses into cards below `md`:
 * - `leading`   — thumbnail/avatar to the left of the headline (one per table)
 * - `primary`   — the headline of the card (one per table)
 * - `secondary` — label/value pairs under the headline
 * - `actions`   — pinned to the top-right of the card, unlabelled
 * - `hidden`    — dropped on mobile; still shown on desktop
 */
export type DataTableColumnPriority =
  | "leading"
  | "primary"
  | "secondary"
  | "actions"
  | "hidden";

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
  /**
   * Role of this column in the mobile card. Optional — see
   * `resolveColumnLayout` for the default derived from column order.
   */
  priority?: DataTableColumnPriority;
  /** Shorter label for the mobile card. Defaults to `header`. */
  mobileLabel?: string;
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
   * Minimum width (CSS value) for the table content on `md` and up. When the
   * viewport is narrower than this, the table scrolls horizontally.
   * Ignored below `md`, where rows render as cards instead.
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
  /**
   * Full override for the mobile card of a row. Use when the default
   * primary/secondary layout can't express the row well enough.
   */
  renderMobileCard?: (item: T) => React.ReactNode;
}

// ── Mobile card layout ───────────────────────────────────────────────

interface ColumnLayout<T> {
  leading: DataTableColumn<T> | null;
  primary: DataTableColumn<T> | null;
  secondary: DataTableColumn<T>[];
  actions: DataTableColumn<T> | null;
}

/**
 * Resolves each column's role in the mobile card.
 *
 * Columns that declare `priority` win. For the rest the default mirrors how
 * these tables are already written: a column keyed `actions` is the action
 * menu, the first remaining column is the headline, and the next two are
 * shown as label/value pairs. Anything beyond that is dropped on mobile.
 * This keeps call sites that never declare `priority` rendering sensibly.
 */
export function resolveColumnLayout<T>(
  columns: DataTableColumn<T>[],
): ColumnLayout<T> {
  const layout: ColumnLayout<T> = {
    leading: null,
    primary: null,
    secondary: [],
    actions: null,
  };

  let implicitIndex = 0;

  for (const column of columns) {
    let priority = column.priority;

    if (!priority) {
      if (column.key === "actions") {
        priority = "actions";
      } else if (implicitIndex === 0) {
        priority = "primary";
      } else if (implicitIndex <= 2) {
        priority = "secondary";
      } else {
        priority = "hidden";
      }
      if (column.key !== "actions") implicitIndex += 1;
    }

    if (priority === "leading" && !layout.leading) {
      layout.leading = column;
    } else if (priority === "leading") {
      continue;
    } else if (priority === "primary" && !layout.primary) {
      layout.primary = column;
    } else if (priority === "actions" && !layout.actions) {
      layout.actions = column;
    } else if (priority === "secondary" || priority === "primary") {
      // A second column marked `primary` degrades to secondary rather than
      // silently disappearing.
      layout.secondary.push(column);
    }
  }

  return layout;
}

function MobileCardRow<T>({
  item,
  layout,
  renderMobileCard,
}: {
  item: T;
  layout: ColumnLayout<T>;
  renderMobileCard?: (item: T) => React.ReactNode;
}) {
  if (renderMobileCard) {
    return <>{renderMobileCard(item)}</>;
  }

  const { leading, primary, secondary, actions } = layout;

  return (
    <Card className="transition-colors">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          {leading && <div className="shrink-0">{leading.render(item)}</div>}
          <div className="min-w-0 flex-1">{primary?.render(item)}</div>
          {actions && <div className="shrink-0">{actions.render(item)}</div>}
        </div>

        {secondary.length > 0 && (
          <dl className="flex flex-wrap gap-x-5 gap-y-2">
            {secondary.map((column) => (
              <div key={column.key} className="min-w-0">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {column.mobileLabel ?? column.header}
                </dt>
                <dd className="mt-0.5 text-sm">{column.render(item)}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The mobile card has no column headers to click, so sorting moves into an
 * explicit control above the list.
 */
function MobileSortBar<T>({
  columns,
  onSort,
  sortConfig,
}: {
  columns: DataTableColumn<T>[];
  onSort: (key: string) => void;
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
}) {
  const sortableColumns = columns.filter(
    (column) => column.sortable !== false && column.key !== "actions",
  );

  if (sortableColumns.length === 0) return null;

  const activeKey = sortConfig?.key ?? "";
  const direction = sortConfig?.direction;

  return (
    <div className="flex items-center gap-2">
      <Select
        inputSize="sm"
        disableSort
        aria-label="Ordenar por"
        placeholder="Ordenar por"
        value={activeKey}
        onChange={(event) => {
          const key = event.target.value;
          if (key) onSort(key);
        }}
      >
        <option value="">Ordenar por</option>
        {sortableColumns.map((column) => (
          <option key={column.key} value={column.key}>
            {column.mobileLabel ?? column.header}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={() => activeKey && onSort(activeKey)}
        disabled={!activeKey}
        aria-label={
          direction === "asc" ? "Ordenar decrescente" : "Ordenar crescente"
        }
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-border/60 bg-card text-muted-foreground transition-colors disabled:opacity-50"
      >
        {direction === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : direction === "desc" ? (
          <ArrowDown className="h-4 w-4" />
        ) : (
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        )}
      </button>
    </div>
  );
}

// ── Desktop header row ───────────────────────────────────────────────

function DataTableHeaderRow<T>({
  columns,
  gridClassName,
  style,
  onSort,
  sortConfig,
}: {
  columns: DataTableColumn<T>[];
  gridClassName?: string;
  style?: React.CSSProperties;
  onSort?: (key: string) => void;
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
}) {
  return (
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
  );
}

function DataTableGridRow<T>({
  item,
  columns,
  gridClassName,
  style,
}: {
  item: T;
  columns: DataTableColumn<T>[];
  gridClassName?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Card className="hover:bg-muted/50 transition-colors">
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
  );
}

/**
 * Shared shell for both modes: header + rows + infinite-scroll sentinel.
 * Below `md` it swaps the grid for a card list (see `resolveColumnLayout`).
 */
function DataTableShell<T>({
  columns,
  items,
  keyExtractor,
  gridClassName,
  onSort,
  sortConfig,
  minWidth,
  renderMobileCard,
  hasMore,
  sentinelRef,
  children,
}: {
  columns: DataTableColumn<T>[];
  items: T[];
  keyExtractor: (item: T) => string;
  gridClassName?: string;
  onSort?: (key: string) => void;
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
  minWidth?: string;
  renderMobileCard?: (item: T) => React.ReactNode;
  hasMore?: boolean;
  sentinelRef?: React.Ref<HTMLDivElement>;
  /** Rendered in place of the rows (loading state). */
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  const colCount = columns.length;
  const style = gridClassName
    ? undefined
    : { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` };
  // minWidth forces horizontal scroll — only ever wanted on the desktop grid.
  const innerStyle = !isMobile && minWidth ? { minWidth } : undefined;

  const layout = React.useMemo(() => resolveColumnLayout(columns), [columns]);

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-4 flex-1" style={innerStyle}>
        {isMobile
          ? onSort && (
              <MobileSortBar
                columns={columns}
                onSort={onSort}
                sortConfig={sortConfig}
              />
            )
          : (
              <DataTableHeaderRow
                columns={columns}
                gridClassName={gridClassName}
                style={style}
                onSort={onSort}
                sortConfig={sortConfig}
              />
            )}

        {children ??
          items.map((item) =>
            isMobile ? (
              <MobileCardRow
                key={keyExtractor(item)}
                item={item}
                layout={layout}
                renderMobileCard={renderMobileCard}
              />
            ) : (
              <DataTableGridRow
                key={keyExtractor(item)}
                item={item}
                columns={columns}
                gridClassName={gridClassName}
                style={style}
              />
            ),
          )}

        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            <Loader size="md" />
          </div>
        )}
      </div>
    </div>
  );
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
  renderMobileCard,
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

  if (isLoading) {
    if (loadingSkeleton) {
      return <>{loadingSkeleton}</>;
    }
    return (
      <DataTableShell
        columns={columns}
        items={[]}
        keyExtractor={keyExtractor}
        gridClassName={gridClassName}
        onSort={onSort}
        sortConfig={sortConfig}
        minWidth={minWidth}
      >
        <div className="flex items-center justify-center py-12">
          <Loader size="md" />
        </div>
      </DataTableShell>
    );
  }

  return (
    <DataTableShell
      columns={columns}
      items={items}
      keyExtractor={keyExtractor}
      gridClassName={gridClassName}
      onSort={onSort}
      sortConfig={sortConfig}
      minWidth={minWidth}
      renderMobileCard={renderMobileCard}
      hasMore={hasMore}
      sentinelRef={sentinelRef}
    />
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
      renderMobileCard={props.renderMobileCard}
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
  renderMobileCard,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  gridClassName?: string;
  onSort?: (key: string) => void;
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
  batchSize?: number;
  minWidth?: string;
  renderMobileCard?: (item: T) => React.ReactNode;
}) {
  const { displayedItems, hasMore, sentinelRef } = useInfiniteScroll(
    data,
    batchSize,
  );

  return (
    <DataTableShell
      columns={columns}
      items={displayedItems}
      keyExtractor={keyExtractor}
      gridClassName={gridClassName}
      onSort={onSort}
      sortConfig={sortConfig}
      minWidth={minWidth}
      renderMobileCard={renderMobileCard}
      hasMore={hasMore}
      sentinelRef={sentinelRef}
    />
  );
}
