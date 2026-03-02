"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

// ============================================
// TYPES
// ============================================

export interface KanbanColumn<T> {
  id: string;
  label: string;
  color: string;
  items: T[];
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  onDragEnd: (itemId: string, fromColumnId: string, toColumnId: string) => void;
  onColumnDragEnd?: (orderedIds: string[]) => void;
  renderCard: (
    item: T,
    columnId: string,
    isDragging?: boolean,
  ) => React.ReactNode;
  renderColumnHeader?: (
    column: KanbanColumn<T>,
    count: number,
  ) => React.ReactNode;
  renderColumnFooter?: (column: KanbanColumn<T>) => React.ReactNode;
  getItemId: (item: T) => string;
  onCardClick?: (item: T) => void;
  emptyMessage?: string;
  isDragEnabled?: boolean;
  showColumnTotals?: boolean;
  getItemValue?: (item: T) => number;
}

// ============================================
// SORTABLE CARD WRAPPER
// ============================================

function SortableCard<T>({
  item,
  columnId,
  getItemId,
  renderCard,
  onCardClick,
  isDragEnabled,
}: {
  item: T;
  columnId: string;
  getItemId: (item: T) => string;
  renderCard: (
    item: T,
    columnId: string,
    isDragging?: boolean,
  ) => React.ReactNode;
  onCardClick?: (item: T) => void;
  isDragEnabled: boolean;
}) {
  const id = getItemId(item);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: "card", columnId, item },
    disabled: !isDragEnabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isDragEnabled ? listeners : {})}
      onClick={(e) => {
        if (!isDragging && onCardClick) {
          e.stopPropagation();
          onCardClick(item);
        }
      }}
      className={cn(
        "touch-manipulation",
        isDragEnabled && "cursor-grab active:cursor-grabbing",
        !isDragEnabled && onCardClick && "cursor-pointer",
      )}
    >
      {renderCard(item, columnId, isDragging)}
    </div>
  );
}

// ============================================
// DROPPABLE COLUMN CONTAINER
// ============================================

function DroppableColumn<T>({
  column,
  children,
  emptyMessage,
  isOverColumn,
  isDragEnabled,
}: {
  column: KanbanColumn<T>;
  children: React.ReactNode;
  emptyMessage: string;
  isOverColumn: boolean;
  isDragEnabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  const showDropHighlight = isDragEnabled && (isOver || isOverColumn);

  return (
    <div
      ref={setNodeRef}
      className="flex-1 p-2.5 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)] kanban-scrollbar"
    >
      {column.items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "flex items-center justify-center py-10 text-xs text-muted-foreground/50 select-none",
            "border-2 border-dashed border-border/20 rounded-lg min-h-[100px]",
            showDropHighlight &&
              "border-primary/30 bg-primary/5 text-primary/50",
          )}
        >
          {showDropHighlight ? "Solte aqui" : emptyMessage}
        </motion.div>
      ) : (
        children
      )}
    </div>
  );
}

// ============================================
// SORTABLE COLUMN WRAPPER
// ============================================

function SortableColumn<T>({
  column,
  children,
  isDragEnabled,
}: {
  column: KanbanColumn<T>;
  children: React.ReactNode;
  isDragEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transition, isDragging } =
    useSortable({
      id: `col-container-${column.id}`,
      data: { type: "column-container", columnId: column.id },
      disabled: !isDragEnabled,
    });

  const style: React.CSSProperties = {
    // Only apply z-index and opacity when dragging.
    // The visual follow movement will be handled by DragOverlay.
    // We intentionally ignore transform when dragging a column
    // to prevent the flex container from shifting chaotically.
    transition,
    zIndex: isDragging ? 10 : "auto",
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "shrink-0 w-[330px] flex flex-col rounded-xl",
        "bg-card/40 dark:bg-card/20 border border-border/40",
        "backdrop-blur-md shadow-sm",
        isDragging && "pointer-events-none",
      )}
    >
      <div
        {...attributes}
        {...(isDragEnabled ? listeners : {})}
        className={cn(isDragEnabled && "cursor-grab active:cursor-grabbing")}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// KANBAN BOARD
// ============================================

export function KanbanBoard<T>({
  columns,
  onDragEnd,
  onColumnDragEnd,
  renderCard,
  renderColumnHeader,
  renderColumnFooter,
  getItemId,
  onCardClick,
  emptyMessage = "Nenhum item",
  isDragEnabled = true,
  showColumnTotals = false,
  getItemValue,
}: KanbanBoardProps<T>) {
  const [activeItem, setActiveItem] = React.useState<{
    item: T;
    columnId: string;
  } | null>(null);
  const [activeColumnId, setActiveColumnId] = React.useState<string | null>(
    null,
  );
  const [activeColumnRect, setActiveColumnRect] = React.useState<{
    height: number;
  } | null>(null);
  const [overColumnId, setOverColumnId] = React.useState<string | null>(null);

  // Sensors with activation constraints to prevent accidental drags
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // Drag-to-scroll logic
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragScrolling, setIsDragScrolling] = React.useState(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);

  const onMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      // Avoid if currently dragging a card or column
      if (activeItem || activeColumnId) return;
      if (!scrollRef.current) return;
      setIsDragScrolling(true);
      startX.current = e.pageX - scrollRef.current.offsetLeft;
      scrollLeft.current = scrollRef.current.scrollLeft;
    },
    [activeItem, activeColumnId],
  );

  const onMouseLeave = React.useCallback(() => {
    setIsDragScrolling(false);
  }, []);

  const onMouseUp = React.useCallback(() => {
    setIsDragScrolling(false);
  }, []);

  const onMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (!isDragScrolling || !scrollRef.current || activeItem) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX.current) * 1.5; // Scroll speed multiplier
      scrollRef.current.scrollLeft = scrollLeft.current - walk;
    },
    [isDragScrolling, activeItem],
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as
      | { type: string; columnId: string; item: T }
      | undefined;
    if (data?.type === "card") {
      setActiveItem({ item: data.item, columnId: data.columnId });
    } else if (data?.type === "column-container") {
      setActiveColumnId(data.columnId);
      if (active.rect.current.initial) {
        setActiveColumnRect({ height: active.rect.current.initial.height });
      }
    }
  }, []);

  const handleDragOver = React.useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }

    const overData = over.data.current as
      | { type?: string; columnId?: string }
      | undefined;

    if (overData?.type === "column") {
      // Hovering directly over a column droppable
      setOverColumnId(overData.columnId || null);
    } else if (overData?.type === "card" && overData.columnId) {
      // Hovering over a card inside a column
      setOverColumnId(overData.columnId);
    } else {
      setOverColumnId(null);
    }
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveItem(null);
      setActiveColumnId(null);
      setOverColumnId(null);
      setActiveColumnRect(null);

      if (!over || !active.data.current) return;

      const activeData = active.data.current as {
        type: string;
        columnId: string;
      };

      const overData = over.data.current as
        | { type?: string; columnId?: string }
        | undefined;

      // Check if we are dragging a column
      if (activeData.type === "column-container" && onColumnDragEnd) {
        let targetColId: string | null = null;
        if (
          overData?.type === "column-container" ||
          overData?.type === "column"
        ) {
          targetColId = overData.columnId || null;
        } else if (over.id.toString().startsWith("col-container-")) {
          targetColId = over.id.toString().replace("col-container-", "");
        } else if (overData?.type === "card" && overData.columnId) {
          targetColId = overData.columnId;
        }

        if (targetColId && activeData.columnId !== targetColId) {
          const oldIndex = columns.findIndex(
            (c) => c.id === activeData.columnId,
          );
          const newIndex = columns.findIndex((c) => c.id === targetColId);
          if (oldIndex !== -1 && newIndex !== -1) {
            const newColumns = arrayMove(columns, oldIndex, newIndex);
            onColumnDragEnd(newColumns.map((c: KanbanColumn<T>) => c.id));
          }
        }
        return;
      }

      const fromColumnId = activeData.columnId;
      let toColumnId: string | null = null;

      if (activeData?.type === "column-container") {
        let targetColId: string | null = null;
        if (
          overData?.type === "column-container" ||
          overData?.type === "column"
        ) {
          targetColId = overData.columnId || null;
        } else if (over.id.toString().startsWith("col-container-")) {
          targetColId = over.id.toString().replace("col-container-", "");
        } else if (overData?.type === "card" && overData.columnId) {
          // If hovering over a card while dragging a column, the target is still the card's column
          targetColId = overData.columnId;
        }
        setOverColumnId(targetColId);
        return;
      }

      if (
        overData?.type === "column" ||
        overData?.type === "column-container"
      ) {
        // Dropped on a column droppable
        toColumnId = overData.columnId || null;
      } else if (overData?.type === "card" && overData.columnId) {
        // Dropped on a card — take that card's column
        toColumnId = overData.columnId;
      } else {
        // Try to find the column by the over id (could be a column-xxx id)
        const overId = over.id as string;
        if (overId.startsWith("column-")) {
          toColumnId = overId.replace("column-", "");
        }
      }

      if (toColumnId && fromColumnId !== toColumnId) {
        onDragEnd(active.id as string, fromColumnId, toColumnId);
      }
    },
    [onDragEnd, onColumnDragEnd],
  );

  const handleDragCancel = React.useCallback(() => {
    setActiveItem(null);
    setActiveColumnId(null);
    setOverColumnId(null);
    setActiveColumnRect(null);
  }, []);

  // Format value for column total
  const formatTotal = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <DndContext
      sensors={isDragEnabled ? sensors : undefined}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        className={cn(
          "flex gap-4 overflow-x-auto pb-4 min-h-[500px] kanban-scrollbar select-none",
          isDragScrolling ? "cursor-grabbing" : "cursor-auto",
        )}
      >
        <SortableContext
          items={columns.map((c) => `col-container-${c.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((column) => {
            const isDropTarget = overColumnId === column.id;
            const columnTotal =
              showColumnTotals && getItemValue
                ? column.items.reduce(
                    (sum, item) => sum + (getItemValue(item) || 0),
                    0,
                  )
                : 0;
            const itemIds = column.items.map(getItemId);

            return (
              <SortableColumn
                key={column.id}
                column={column}
                isDragEnabled={isDragEnabled}
              >
                {/* Column Header */}
                <div className="px-4 py-3 border-b border-border/30">
                  {renderColumnHeader ? (
                    renderColumnHeader(column, column.items.length)
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full shadow-sm"
                            style={{
                              backgroundColor: column.color,
                              boxShadow: `0 0 8px ${column.color}40`,
                            }}
                          />
                          <span className="text-sm font-semibold text-foreground">
                            {column.label}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-full tabular-nums">
                          {column.items.length}
                        </span>
                      </div>
                      {showColumnTotals && getItemValue && columnTotal > 0 && (
                        <div className="text-xs font-medium text-muted-foreground pl-5.5">
                          {formatTotal(columnTotal)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Column Body — Droppable Container */}
                <SortableContext
                  items={itemIds}
                  strategy={verticalListSortingStrategy}
                  id={column.id}
                >
                  <DroppableColumn
                    column={column}
                    emptyMessage={emptyMessage}
                    isOverColumn={isDropTarget}
                    isDragEnabled={isDragEnabled}
                  >
                    <AnimatePresence mode="popLayout">
                      {column.items.map((item) => (
                        <motion.div
                          key={getItemId(item)}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                        >
                          <SortableCard
                            item={item}
                            columnId={column.id}
                            getItemId={getItemId}
                            renderCard={renderCard}
                            onCardClick={onCardClick}
                            isDragEnabled={isDragEnabled}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </DroppableColumn>
                </SortableContext>

                {/* Column Footer */}
                {renderColumnFooter && (
                  <div className="px-3 py-2 border-t border-border/20">
                    {renderColumnFooter(column)}
                  </div>
                )}
              </SortableColumn>
            );
          })}
        </SortableContext>
      </div>

      {/* Drag Overlay — renders floating card or column while dragging */}
      <DragOverlay
        dropAnimation={{
          duration: 250,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1)",
        }}
        style={{ height: "100%", zIndex: 30 }}
      >
        {activeItem ? (
          <div className="rotate-2 scale-105 shadow-2xl shadow-black/20 pointer-events-none">
            {renderCard(activeItem.item, activeItem.columnId, true)}
          </div>
        ) : activeColumnId ? (
          (() => {
            const column = columns.find((c) => c.id === activeColumnId);
            if (!column) return null;
            const columnTotal =
              showColumnTotals && getItemValue
                ? column.items.reduce(
                    (sum, item) => sum + (getItemValue(item) || 0),
                    0,
                  )
                : 0;

            return (
              <div
                className={cn(
                  "shrink-0 w-[330px] flex flex-col rounded-xl overflow-hidden",
                  "bg-card/90 dark:bg-card/90 border border-primary/30",
                  "backdrop-blur-md shadow-2xl shadow-black/20 pointer-events-none rotate-2 scale-[1.02]",
                )}
                // Use the exact height of the dragged column to prevent it from shrinking
                style={{
                  height: activeColumnRect
                    ? `${activeColumnRect.height}px`
                    : "100%",
                  maxHeight: "calc(100vh - 100px)",
                }}
              >
                {/* Column Header */}
                <div className="px-4 py-3 border-b border-border/30">
                  {renderColumnHeader ? (
                    renderColumnHeader(column, column.items.length)
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full shadow-sm"
                            style={{
                              backgroundColor: column.color,
                              boxShadow: `0 0 8px ${column.color}40`,
                            }}
                          />
                          <span className="text-sm font-semibold text-foreground">
                            {column.label}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-full tabular-nums">
                          {column.items.length}
                        </span>
                      </div>
                      {showColumnTotals && getItemValue && columnTotal > 0 && (
                        <div className="text-xs font-medium text-muted-foreground pl-5.5">
                          {formatTotal(columnTotal)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Column Body Snapshot */}
                <div className="flex-1 p-2.5 space-y-2 overflow-y-hidden max-h-[calc(100vh-300px)] opacity-60 kanban-scrollbar">
                  {column.items.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-xs text-muted-foreground/50 select-none border-2 border-dashed border-border/20 rounded-lg min-h-[100px]">
                      {emptyMessage}
                    </div>
                  ) : (
                    column.items.map((item) => (
                      <div key={getItemId(item)}>
                        {renderCard(item, column.id, false)}
                      </div>
                    ))
                  )}
                </div>

                {/* Column Footer */}
                {renderColumnFooter && (
                  <div className="px-3 py-2 border-t border-border/20">
                    {renderColumnFooter(column)}
                  </div>
                )}
              </div>
            );
          })()
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
