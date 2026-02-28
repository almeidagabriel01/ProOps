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
  useSortable,
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
// KANBAN BOARD
// ============================================

export function KanbanBoard<T>({
  columns,
  onDragEnd,
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
      // Avoid if currently dragging a card
      if (activeItem) return;
      if (!scrollRef.current) return;
      setIsDragScrolling(true);
      startX.current = e.pageX - scrollRef.current.offsetLeft;
      scrollLeft.current = scrollRef.current.scrollLeft;
    },
    [activeItem],
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

  // Build a map from itemId to columnId for fast lookup
  const itemColumnMap = React.useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach((col) => {
      col.items.forEach((item) => {
        map.set(getItemId(item), col.id);
      });
    });
    return map;
  }, [columns, getItemId]);

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as
      | { type: string; columnId: string; item: T }
      | undefined;
    if (data?.type === "card") {
      setActiveItem({ item: data.item, columnId: data.columnId });
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
      setOverColumnId(null);

      if (!over || !active.data.current) return;

      const activeData = active.data.current as {
        type: string;
        columnId: string;
      };
      const overData = over.data.current as
        | { type?: string; columnId?: string }
        | undefined;

      const fromColumnId = activeData.columnId;
      let toColumnId: string | null = null;

      if (overData?.type === "column") {
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
    [onDragEnd],
  );

  const handleDragCancel = React.useCallback(() => {
    setActiveItem(null);
    setOverColumnId(null);
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
            <motion.div
              key={column.id}
              layout
              className={cn(
                "flex-shrink-0 w-[330px] flex flex-col rounded-xl transition-all duration-200 ease-out",
                "bg-card/40 dark:bg-card/20 border border-border/40",
                "backdrop-blur-md shadow-sm",
                isDropTarget &&
                  "ring-2 ring-primary/50 bg-primary/5 dark:bg-primary/10 border-primary/40 shadow-lg shadow-primary/5",
              )}
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
            </motion.div>
          );
        })}
      </div>

      {/* Drag Overlay — renders floating card while dragging */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
        {activeItem ? (
          <div className="rotate-[2deg] scale-105 shadow-2xl shadow-black/20 pointer-events-none">
            {renderCard(activeItem.item, activeItem.columnId, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
