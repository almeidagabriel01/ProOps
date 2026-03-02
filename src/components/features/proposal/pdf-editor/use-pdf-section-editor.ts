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
        content.includes("condicao de pagamento") ||
        content.includes("formas de pagamento")
      );
    },
    [normalizeText],
  );

  const isPaymentText = React.useCallback(
    (section: PdfSection): boolean => {
      if (section.type !== "text") return false;
      const content = normalizeText(section.content);
      return (
        content.includes("formas de pagamento") ||
        content.includes("pagamento a vista") ||
        content.includes("entrada:") ||
        content.includes("parcelamento:") ||
        content.includes("saldo:")
      );
    },
    [normalizeText],
  );

  const isGroupedTitle = React.useCallback(
    (section: PdfSection): boolean => {
      if (section.type !== "title") return false;
      const content = normalizeText(section.content);
      return (
        content.includes("garantia") ||
        content.includes("condicoes de pagamento") ||
        content.includes("condicao de pagamento")
      );
    },
    [normalizeText],
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

  const createPaymentTermsSection = React.useCallback(
    (): PdfSection => ({
      id: crypto.randomUUID(),
      type: "payment-terms",
      content: "Condições de Pagamento",
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

  const ensureScopeGroupId = React.useCallback((inputSections: PdfSection[]) => {
    const sectionsWithGroups = inputSections.map((section) => ({ ...section }));

    sectionsWithGroups.forEach((section, index) => {
      if (section.type !== "product-table") return;

      const previous = sectionsWithGroups[index - 1];
      const previousTwo = sectionsWithGroups[index - 2];

      if (section.groupId) {
        if (previous?.type === "text") {
          previous.groupId = previous.groupId || section.groupId;
        }
        if (previousTwo?.type === "title") {
          previousTwo.groupId = previousTwo.groupId || section.groupId;
        }
        return;
      }

      if (previous?.type === "text" && previousTwo?.type === "title") {
        const groupId = crypto.randomUUID();
        section.groupId = groupId;
        previous.groupId = previous.groupId || groupId;
        previousTwo.groupId = previousTwo.groupId || groupId;
      }
    });

    return sectionsWithGroups;
  }, []);

  const getLinkedProductBlockRange = React.useCallback(
    (currentSections: PdfSection[], productIndex: number) => {
      const productSection = currentSections[productIndex];

      if (productSection?.groupId) {
        const groupedIndexes = currentSections
          .map((section, index) => ({ section, index }))
          .filter(
            ({ section }) =>
              section.groupId === productSection.groupId &&
              (section.type === "title" ||
                section.type === "text" ||
                section.type === "product-table"),
          )
          .map(({ index }) => index);

        if (groupedIndexes.length > 0) {
          return {
            start: Math.min(...groupedIndexes),
            end: Math.max(...groupedIndexes),
          };
        }
      }

      if (
        productIndex >= 2 &&
        currentSections[productIndex]?.type === "product-table" &&
        currentSections[productIndex - 1]?.type === "text" &&
        currentSections[productIndex - 2]?.type === "title"
      ) {
        return { start: productIndex - 2, end: productIndex };
      }

      return { start: productIndex, end: productIndex };
    },
    [],
  );

  const getLinkedTitleTextRange = React.useCallback(
    (currentSections: PdfSection[], titleIndex: number) => {
      if (
        currentSections[titleIndex]?.type === "title" &&
        isGroupedTitle(currentSections[titleIndex]) &&
        currentSections[titleIndex + 1]?.type === "text"
      ) {
        return { start: titleIndex, end: titleIndex + 1 };
      }

      return { start: titleIndex, end: titleIndex };
    },
    [isGroupedTitle],
  );

  const getRangeForSectionAt = React.useCallback(
    (currentSections: PdfSection[], index: number) => {
      const section = currentSections[index];
      if (!section) return { start: index, end: index };

      if (section.type === "product-table") {
        return getLinkedProductBlockRange(currentSections, index);
      }

      if (section.type === "title") {
        return getLinkedTitleTextRange(currentSections, index);
      }

      return { start: index, end: index };
    },
    [getLinkedProductBlockRange, getLinkedTitleTextRange],
  );

  const normalizeSections = React.useCallback(
    (currentSections: PdfSection[]): PdfSection[] => {
      const sectionsWithGroups = ensureScopeGroupId(currentSections);
      const hasPaymentTermsCard = sectionsWithGroups.some(
        (section) => section.type === "payment-terms",
      );

      let firstProductTable: PdfSection | null = null;
      let firstPaymentTerms: PdfSection | null = null;
      const normalized: PdfSection[] = [];

      sectionsWithGroups.forEach((section) => {
        if (section.type === "product-table") {
          if (firstProductTable) return;
          firstProductTable = {
            ...section,
            content: "Sistemas / Ambientes / Produtos",
            columnWidth: 100,
          };
          normalized.push(firstProductTable);
          return;
        }

        if (section.type === "payment-terms") {
          if (firstPaymentTerms) return;
          firstPaymentTerms = {
            ...section,
            columnWidth: 100,
          };
          normalized.push(firstPaymentTerms);
          return;
        }

        if (hasPaymentTermsCard && (isPaymentTitle(section) || isPaymentText(section))) {
          return;
        }

        normalized.push(section);
      });

      if (!firstProductTable) {
        normalized.push(createFixedProductTableSection());
      }

      const hadPaymentTerms = hasPaymentTermsCard;
      if (hadPaymentTerms && !firstPaymentTerms) {
        normalized.push(createPaymentTermsSection());
      }

      return normalized;
    },
    [
      createFixedProductTableSection,
      createPaymentTermsSection,
      ensureScopeGroupId,
      isPaymentText,
      isPaymentTitle,
    ],
  );

  const needsNormalization = React.useCallback(
    (currentSections: PdfSection[]): boolean => {
      const productTableSections = currentSections.filter(
        (section) => section.type === "product-table",
      );
      const paymentTermsSections = currentSections.filter(
        (section) => section.type === "payment-terms",
      );
      const shouldExpectPaymentTerms = paymentTermsSections.length > 0;

      if (productTableSections.length !== 1) return true;
      if (shouldExpectPaymentTerms && paymentTermsSections.length !== 1) {
        return true;
      }

      const [productTable] = productTableSections;
      const [paymentTerms] = paymentTermsSections;

      const productTableIsValid =
        productTable.content === "Sistemas / Ambientes / Produtos" &&
        productTable.columnWidth === 100;
      const paymentTermsIsValid = shouldExpectPaymentTerms
        ? Boolean(paymentTerms && paymentTerms.columnWidth === 100)
        : true;
      const missingScopeGroupId = !productTable.groupId;

      const hasLegacyPaymentBlocks = currentSections.some(
        (section) => isPaymentTitle(section) || isPaymentText(section),
      );
      const shouldRemoveLegacyPaymentBlocks =
        shouldExpectPaymentTerms && hasLegacyPaymentBlocks;

      return (
        !productTableIsValid ||
        !paymentTermsIsValid ||
        missingScopeGroupId ||
        shouldRemoveLegacyPaymentBlocks
      );
    },
    [isPaymentText, isPaymentTitle],
  );

  React.useEffect(() => {
    if (needsNormalization(sections)) {
      onChange(normalizeSections(sections));
    }
  }, [needsNormalization, normalizeSections, onChange, sections]);

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

  const healLayout = React.useCallback(
    (currentSections: PdfSection[]) => {
      const healed = currentSections.map((section, index) => {
        if (section.type === "product-table") {
          return {
            ...section,
            content: "Sistemas / Ambientes / Produtos",
            columnWidth: 100,
          };
        }

        if (section.type === "payment-terms") {
          return {
            ...section,
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
    },
    [normalizeSections],
  );

  const addSection = (type: PdfSection["type"]) => {
    if (type === "product-table") {
      alert("Este bloco é fixo e já existe na proposta.");
      return;
    }

    if (type === "payment-terms") {
      alert("Este bloco é gerenciado automaticamente.");
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
        textAlign: "left",
        color: type === "title" ? primaryColor : "#374151",
        marginTop: "16px",
        marginBottom: "8px",
      },
    };

    onChange(healLayout([...sections, newSection]));
    setExpandedSections((prev) => new Set(prev).add(newSection.id));
  };

  const removeSection = (id: string) => {
    const sectionIndex = sections.findIndex((s) => s.id === id);
    if (sectionIndex === -1) return;

    const { start, end } = getRangeForSectionAt(sections, sectionIndex);
    const idsToRemove = new Set(sections.slice(start, end + 1).map((item) => item.id));
    const nextSections = sections.filter((section) => !idsToRemove.has(section.id));

    onChange(healLayout(nextSections));
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    const currentIndex = sections.findIndex((s) => s.id === id);
    if (currentIndex === -1) return;

    const movingRange = getRangeForSectionAt(sections, currentIndex);
    const block = sections.slice(movingRange.start, movingRange.end + 1);

    if (direction === "up") {
      if (movingRange.start === 0) return;

      const anchorIndex = movingRange.start - 1;
      const targetRange = getRangeForSectionAt(sections, anchorIndex);
      const beforeTarget = sections.slice(0, targetRange.start);
      const targetBlock = sections.slice(targetRange.start, targetRange.end + 1);
      const between = sections.slice(targetRange.end + 1, movingRange.start);
      const afterMoving = sections.slice(movingRange.end + 1);

      onChange(
        healLayout([...beforeTarget, ...block, ...targetBlock, ...between, ...afterMoving]),
      );
      return;
    }

    if (movingRange.end === sections.length - 1) return;

    const anchorIndex = movingRange.end + 1;
    const targetRange = getRangeForSectionAt(sections, anchorIndex);
    const beforeMoving = sections.slice(0, movingRange.start);
    const between = sections.slice(movingRange.end + 1, targetRange.start);
    const targetBlock = sections.slice(targetRange.start, targetRange.end + 1);
    const afterTarget = sections.slice(targetRange.end + 1);

    onChange(
      healLayout([...beforeMoving, ...between, ...targetBlock, ...block, ...afterTarget]),
    );
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === id) return;

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

    const movingRange = getRangeForSectionAt(sections, draggedIndex);
    const movingBlock = sections.slice(movingRange.start, movingRange.end + 1);
    const withoutMoving = [...sections];
    withoutMoving.splice(movingRange.start, movingBlock.length);

    const adjustedTargetIndex = withoutMoving.findIndex((s) => s.id === targetId);
    if (adjustedTargetIndex === -1) return;

    const targetRange = getRangeForSectionAt(withoutMoving, adjustedTargetIndex);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const canSideDrop =
      movingBlock.length === 1 &&
      movingBlock[0].type !== "product-table" &&
      movingBlock[0].type !== "payment-terms";
    const isSideDrop =
      canSideDrop && (offsetX < rect.width * 0.3 || offsetX > rect.width * 0.7);

    const computedPlacement: "top" | "bottom" | "left" | "right" = isSideDrop
      ? offsetX < rect.width * 0.5
        ? "left"
        : "right"
      : offsetY < rect.height * 0.5
        ? "top"
        : "bottom";

    if (isSideDrop) {
      const moving = movingBlock[0];
      moving.columnWidth = 50;

      const targetSection = withoutMoving[adjustedTargetIndex];
      if (!targetSection.columnWidth || targetSection.columnWidth === 100) {
        withoutMoving[adjustedTargetIndex] = { ...targetSection, columnWidth: 50 };
      } else {
        moving.columnWidth = targetSection.columnWidth;
      }
    } else {
      movingBlock.forEach((section) => {
        section.columnWidth = 100;
      });
    }

    const shouldInsertAfter =
      computedPlacement === "bottom" || computedPlacement === "right";
    const insertIndex = shouldInsertAfter ? targetRange.end + 1 : targetRange.start;

    withoutMoving.splice(insertIndex, 0, ...movingBlock);

    onChange(healLayout(withoutMoving));
    setDraggedId(null);
    setDragOverId(null);
    setDropPlacement(null);
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId) return;

    const draggedIndex = sections.findIndex((s) => s.id === draggedId);
    if (draggedIndex === -1) return;

    const movingRange = getRangeForSectionAt(sections, draggedIndex);
    const block = sections.slice(movingRange.start, movingRange.end + 1);
    const nextSections = [...sections];
    nextSections.splice(movingRange.start, block.length);

    block.forEach((section) => {
      section.columnWidth = 100;
    });

    nextSections.push(...block);
    onChange(healLayout(nextSections));

    setDraggedId(null);
    setDragOverId(null);
    setDropPlacement(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setDropPlacement(null);
  };

  const updateSection = (id: string, updates: Partial<PdfSection>) => {
    onChange(sections.map((section) => (section.id === id ? { ...section, ...updates } : section)));
  };

  const updateStyle = (
    id: string,
    styleKey: keyof PdfSection["styles"],
    value: string,
  ) => {
    onChange(
      sections.map((section) =>
        section.id === id
          ? { ...section, styles: { ...section.styles, [styleKey]: value } }
          : section,
      ),
    );
  };

  const handleImageUpload = (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
