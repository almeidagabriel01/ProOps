"use client";

import * as React from "react";
import { PdfSection } from "../pdf-section-editor";

export interface UsePdfSectionEditorProps {
  sections: PdfSection[];
  onChange: (sections: PdfSection[]) => void;
  primaryColor: string;
}

export interface UsePdfSectionEditorReturn {
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  draggedId: string | null;
  dragOverId: string | null;
  dropPlacement: "top" | "bottom" | "left" | "right" | null;
  hoveredHandleId: string | null;
  setHoveredHandleId: React.Dispatch<React.SetStateAction<string | null>>;
  addSection: (type: PdfSection["type"]) => void;
  removeSection: (id: string) => void;
  moveSection: (id: string, direction: "up" | "down") => void;
  updateSection: (id: string, updates: Partial<PdfSection>) => void;
  updateStyle: (
    id: string,
    styleKey: keyof PdfSection["styles"],
    value: string,
  ) => void;
  handleImageUpload: (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  handleDragStart: (e: React.DragEvent, id: string) => void;
  handleDragOver: (e: React.DragEvent, id: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, targetId: string) => void;
  handleContainerDrop: (e: React.DragEvent) => void;
  handleDragEnd: () => void;
}

/**
 * Hook for PDF section editor state and logic
 */
export function usePdfSectionEditor({
  sections,
  onChange,
  primaryColor,
}: UsePdfSectionEditorProps): UsePdfSectionEditorReturn {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(),
  );
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [dropPlacement, setDropPlacement] = React.useState<
    "top" | "bottom" | "left" | "right" | null
  >(null);
  const [hoveredHandleId, setHoveredHandleId] = React.useState<string | null>(
    null,
  );
  const SCOPE_ANCHOR_TEXT =
    "esta proposta contempla os seguintes produtos e servicos conforme especificado na tabela abaixo";

  const normalizeText = React.useCallback((value?: string): string => {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }, []);

  const isPaymentTitle = React.useCallback(
    (section: PdfSection): boolean => {
      if (section.type !== "title") return false;
      const content = normalizeText(section.content);
      return (
        content.includes("condicoes de pagamento") ||
        content.includes("formas de pagamento")
      );
    },
    [normalizeText],
  );

  const getFixedProductInsertIndex = React.useCallback(
    (baseSections: PdfSection[]): number => {
      const scopeTextIndex = baseSections.findIndex((section) => {
        if (section.type !== "text") return false;
        return normalizeText(section.content).includes(SCOPE_ANCHOR_TEXT);
      });

      if (scopeTextIndex !== -1) {
        return scopeTextIndex + 1;
      }

      const paymentTitleIndex = baseSections.findIndex((section) =>
        isPaymentTitle(section),
      );

      if (paymentTitleIndex !== -1) {
        return paymentTitleIndex;
      }

      return Math.min(2, baseSections.length);
    },
    [isPaymentTitle, normalizeText],
  );

  const createFixedProductTableSection = React.useCallback(
    (): PdfSection => ({
      id: crypto.randomUUID(),
      type: "product-table",
      content: "Sistemas / Ambientes / Produtos",
      columnWidth: 100,
      styles: {
        fontSize: "14px",
        fontWeight: "normal",
        textAlign: "left",
        color: "#374151",
        marginTop: "16px",
        marginBottom: "8px",
      },
    }),
    [],
  );

  const normalizeSections = React.useCallback(
    (currentSections: PdfSection[]): PdfSection[] => {
      let firstProductTable: PdfSection | null = null;
      const baseSections: PdfSection[] = [];

      currentSections.forEach((section) => {
        if (section.type !== "product-table") {
          baseSections.push(section);
          return;
        }

        if (firstProductTable) {
          return;
        }

        const normalizedProductTable: PdfSection =
          section.content === "Sistemas / Ambientes / Produtos" &&
          section.columnWidth === 100
            ? section
            : {
                ...section,
                content: "Sistemas / Ambientes / Produtos",
                columnWidth: 100,
              };

        firstProductTable = normalizedProductTable;
      });

      const productTableSection = firstProductTable || createFixedProductTableSection();
      const insertIndex = getFixedProductInsertIndex(baseSections);

      return [
        ...baseSections.slice(0, insertIndex),
        productTableSection,
        ...baseSections.slice(insertIndex),
      ];
    },
    [createFixedProductTableSection, getFixedProductInsertIndex],
  );

  const needsNormalization = React.useCallback(
    (currentSections: PdfSection[]): boolean => {
      const productTableSections = currentSections.filter(
        (section) => section.type === "product-table",
      );

      if (productTableSections.length !== 1) {
        return true;
      }

      const [productTable] = productTableSections;

      return !(
        productTable.content === "Sistemas / Ambientes / Produtos" &&
        productTable.columnWidth === 100
      );
    },
    [],
  );

  React.useEffect(() => {
    if (needsNormalization(sections)) {
      const normalized = normalizeSections(sections);
      onChange(normalized);
    }
  }, [sections, onChange, normalizeSections, needsNormalization]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const healLayout = (currentSections: PdfSection[]) => {
    const healed = currentSections.map((section, index) => {
      if (section.type === "product-table") {
        return {
          ...section,
          content: "Sistemas / Ambientes / Produtos",
          columnWidth: 100,
        };
      }

      if (!section.columnWidth || section.columnWidth === 100) return section;

      const prev = currentSections[index - 1];
      const next = currentSections[index + 1];

      const prevIsPartial = prev && prev.columnWidth && prev.columnWidth < 100;
      const nextIsPartial = next && next.columnWidth && next.columnWidth < 100;

      if (!prevIsPartial && !nextIsPartial) {
        return { ...section, columnWidth: 100 };
      }
      return section;
    });

    return normalizeSections(healed);
  };

  const addSection = (type: PdfSection["type"]) => {
    if (type === "product-table") {
      alert("Este bloco é fixo e já existe na proposta.");
      return;
    }

    const newSection: PdfSection = {
      id: crypto.randomUUID(),
      type,
      content:
        type === "title"
          ? "Novo Título"
          : type === "text"
            ? "Novo parágrafo de texto..."
            : "",
      styles: {
        fontSize: type === "title" ? "24px" : "14px",
        fontWeight: type === "title" ? "bold" : "normal",
        textAlign: type === "title" ? "left" : "left",
        color: type === "title" ? primaryColor : "#374151",
        marginTop: "16px",
        marginBottom: "8px",
      },
    };
    onChange(healLayout([...sections, newSection]));
    setExpandedSections((prev) => new Set(prev).add(newSection.id));
  };

  const removeSection = (id: string) => {
    const sectionToRemove = sections.find((s) => s.id === id);
    if (sectionToRemove?.type === "product-table") {
      alert("Este bloco é fixo e não pode ser removido.");
      return;
    }

    const newSections = sections.filter((s) => s.id !== id);
    onChange(healLayout(newSections));
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;
    if (sections[index].type === "product-table") return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sections.length - 1) return;

    const newSections = [...sections];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newSections[index], newSections[swapIndex]] = [
      newSections[swapIndex],
      newSections[index],
    ];
    onChange(healLayout(newSections));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    const section = sections.find((s) => s.id === id);
    if (section?.type === "product-table") {
      e.preventDefault();
      return;
    }

    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) {
      setDragOverId(id);

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      if (offsetX < rect.width * 0.3) {
        setDropPlacement("left");
      } else if (offsetX > rect.width * 0.7) {
        setDropPlacement("right");
      } else if (offsetY < rect.height * 0.5) {
        setDropPlacement("top");
      } else {
        setDropPlacement("bottom");
      }
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
    setDropPlacement(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = sections.findIndex((s) => s.id === draggedId);
    const targetIndex = sections.findIndex((s) => s.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const targetSection = sections[targetIndex];
    const newSections = [...sections];
    const [removed] = newSections.splice(draggedIndex, 1);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;

    const isSideDrop = offsetX < rect.width * 0.3 || offsetX > rect.width * 0.7;

    if (isSideDrop) {
      removed.columnWidth = 50;
      if (!targetSection.columnWidth || targetSection.columnWidth === 100) {
        const adjust = draggedIndex < targetIndex ? -1 : 0;
        const actualTargetIndex = targetIndex + adjust;
        if (newSections[actualTargetIndex]) {
          newSections[actualTargetIndex] = {
            ...newSections[actualTargetIndex],
            columnWidth: 50,
          };
        }
      } else {
        removed.columnWidth = targetSection.columnWidth;
      }
    } else {
      removed.columnWidth = 100;
    }

    if (removed.type === "product-table") {
      removed.columnWidth = 100;
      removed.content = "Sistemas / Ambientes / Produtos";
    }

    newSections.splice(targetIndex, 0, removed);

    onChange(healLayout(newSections));
    setDraggedId(null);
    setDragOverId(null);
    setDropPlacement(null);
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId) return;

    const draggedIndex = sections.findIndex((s) => s.id === draggedId);
    if (draggedIndex === -1) return;

    const newSections = [...sections];
    const [removed] = newSections.splice(draggedIndex, 1);

    removed.columnWidth = 100;
    newSections.push(removed);

    onChange(healLayout(newSections));
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const updateSection = (id: string, updates: Partial<PdfSection>) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const updateStyle = (
    id: string,
    styleKey: keyof PdfSection["styles"],
    value: string,
  ) => {
    onChange(
      sections.map((s) =>
        s.id === id ? { ...s, styles: { ...s.styles, [styleKey]: value } } : s,
      ),
    );
  };

  const handleImageUpload = (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem da seção deve ter no máximo 2MB.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        updateSection(id, { imageUrl: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return {
    expandedSections,
    toggleSection,
    draggedId,
    dragOverId,
    dropPlacement,
    hoveredHandleId,
    setHoveredHandleId,
    addSection,
    removeSection,
    moveSection,
    updateSection,
    updateStyle,
    handleImageUpload,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleContainerDrop,
    handleDragEnd,
  };
}
