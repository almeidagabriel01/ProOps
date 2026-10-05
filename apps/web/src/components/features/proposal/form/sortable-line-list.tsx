"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableLineListProps<T> {
  items: readonly T[];
  getId: (item: T) => string | undefined;
  /** Soltou `activeId` no lugar de `overId`. */
  onMove: (activeId: string, overId: string) => void;
  disabled?: boolean;
  renderItem: (item: T, index: number) => React.ReactNode;
}

/**
 * Linhas de um ambiente da proposta, arrastáveis pela alça à esquerda. Só a
 * alça inicia o arraste: os campos da linha (markup, valor, quantidade)
 * continuam recebendo clique e toque normalmente. Sem id em alguma linha, ou
 * com `disabled`, a lista é a mesma, sem alça.
 */
export function SortableLineList<T>({
  items,
  getId,
  onMove,
  disabled,
  renderItem,
}: SortableLineListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map(getId);
  const sortable = !disabled && items.length > 1 && ids.every(Boolean);

  if (!sortable) {
    return <>{items.map((item, index) => renderItem(item, index))}</>;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (!overId || event.active.id === overId) return;
    onMove(String(event.active.id), String(overId));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids as string[]} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableLine key={ids[index]} id={ids[index] as string}>
            {renderItem(item, index)}
          </SortableLine>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableLine({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-stretch gap-1",
        isDragging && "relative z-10 opacity-80",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Arrastar para mudar a ordem"
        title="Arraste para mudar a ordem"
        className="flex w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
