"use client";

import * as React from "react";
import { PdfSection } from "../pdf-section-editor";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level pure helpers — no React, no side-effects, easy to test
// ─────────────────────────────────────────────────────────────────────────────

function normalizeStr(value?: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Is this section the "Escopo do Projeto" title? */
function isScopeTitle(section: PdfSection): boolean {
  return (
    section.type === "title" &&
    normalizeStr(section.content).includes("escopo")
  );
}

/** Is this section the "Esta proposta contempla..." intro text? */
function isScopeIntroText(section: PdfSection): boolean {
  if (section.type !== "text") return false;
  const n = normalizeStr(section.content);
  return (
    n.includes("esta proposta contempla") ||
    n.includes("esta proposta comtempla")
  );
}

function isPaymentTitleSection(section: PdfSection): boolean {
  if (section.type !== "title") return false;
  const n = normalizeStr(section.content);
  return (
    n.includes("condicoes de pagamento") ||
    n.includes("condicao de pagamento") ||
    n.includes("formas de pagamento")
  );
}

function isPaymentTextSection(section: PdfSection): boolean {
  if (section.type !== "text") return false;
  const n = normalizeStr(section.content);
  return (
    n.includes("formas de pagamento") ||
    n.includes("pagamento a vista") ||
    n.includes("entrada:") ||
    n.includes("parcelamento:") ||
    n.includes("saldo:")
  );
}

function isWarrantyOrPaymentGroupedTitle(section: PdfSection): boolean {
  if (section.type !== "title") return false;
  const n = normalizeStr(section.content);
  return (
    n.includes("garantia") ||
    n.includes("condicoes de pagamento") ||
    n.includes("condicao de pagamento")
  );
}

/**
 * Returns the CONTIGUOUS index range [start, end] that the product-table
 * "block" occupies in the real sections array.
 *
 * The algorithm expands LEFT and RIGHT from productIndex, including only
 * immediately adjacent sections that share the same groupId. This guarantees
 * the range is always a contiguous slice — so sections with the same groupId
 * that are elsewhere in the array (due to manual reordering or stale data)
 * are never included and never cause the block to span the whole list.
 *
 * If the product-table has no groupId the range is just itself.
 */
function computeProductBlockRange(
  sections: PdfSection[],
  productIndex: number,
): { start: number; end: number } {
  const productSection = sections[productIndex];
  if (!productSection?.groupId) {
    return { start: productIndex, end: productIndex };
  }

  const groupId = productSection.groupId;

  // Expand LEFT — stop as soon as a section does NOT share the groupId
  let start = productIndex;
  while (start > 0 && sections[start - 1]?.groupId === groupId) {
    start -= 1;
  }

  // Expand RIGHT — stop as soon as a section does NOT share the groupId
  let end = productIndex;
  while (end < sections.length - 1 && sections[end + 1]?.groupId === groupId) {
    end += 1;
  }

  return { start, end };
}

function createDefaultProductTableSection(): PdfSection {
  return {
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
  };
}

function createDefaultPaymentTermsSection(): PdfSection {
  return {
    id: crypto.randomUUID(),
    type: "payment-terms",
    content: "Condicoes de Pagamento",
    columnWidth: 100,
    styles: {
      fontSize: "14px",
      fontWeight: "normal",
      textAlign: "left",
      color: "#374151",
      marginTop: "16px",
      marginBottom: "8px",
    },
  };
}

/**
 * Full normalization pass — called only from the useEffect guard and after
 * structural changes (add/remove section).
 *
 * Responsibilities:
 *  1. Deduplicate product-table and payment-terms (keep first occurrence)
 *  2. Remove legacy payment text blocks when a payment-terms card is present
 *  3. Ensure product-table has correct content + columnWidth
 *  4. GUARANTEE the scope block is physically contiguous:
 *       [scopeTitle?] + [scopeIntroText?] + [product-table]
 *     Members are identified purely by content (position-independent), then
 *     physically reordered so they always sit together in the array.
 *     This is the authoritative fix for stale/corrupted proposals where
 *     scope title/intro had the right groupId but were far from the product-table.
 *  5. Assign a stable single groupId to the contiguous scope block
 *  6. Strip that groupId from any section that does not belong to the block
 *  7. Inject missing product-table / payment-terms if absent
 */
function normalizeSections(sections: PdfSection[]): PdfSection[] {
  const hasPaymentTermsCard = sections.some((s) => s.type === "payment-terms");

  // ── Identify scope block members by content (position-independent) ────────
  const scopeTitleSection = sections.find(isScopeTitle) ?? null;
  const scopeIntroSection = sections.find(isScopeIntroText) ?? null;
  const scopeMemberIds = new Set<string>(
    [scopeTitleSection?.id, scopeIntroSection?.id].filter(
      Boolean,
    ) as string[],
  );

  // ── Single pass: route every section into before/after the product-table ──
  let firstProductTable: PdfSection | null = null;
  let firstPaymentTerms: PdfSection | null = null;
  const before: PdfSection[] = []; // non-scope sections that appeared before PT
  const after: PdfSection[] = [];  // non-scope sections that appeared after PT

  for (const section of sections) {
    // product-table — marks the split point; deduplicate extras
    if (section.type === "product-table") {
      if (firstProductTable) continue;
      firstProductTable = {
        ...section,
        content: "Sistemas / Ambientes / Produtos",
        columnWidth: 100,
      };
      continue;
    }

    // Scope members: skip here — placed contiguously below
    if (scopeMemberIds.has(section.id)) continue;

    // payment-terms — deduplicate
    if (section.type === "payment-terms") {
      if (firstPaymentTerms) continue;
      firstPaymentTerms = { ...section, columnWidth: 100 };
      (!firstProductTable ? before : after).push(firstPaymentTerms);
      continue;
    }

    // Legacy manual payment blocks — drop when a payment-terms card is present
    if (hasPaymentTermsCard && isPaymentTitleSection(section)) continue;
    if (hasPaymentTermsCard && isPaymentTextSection(section)) continue;

    // Everything else: route by position relative to product-table
    (!firstProductTable ? before : after).push(section);
  }

  // ── Build the contiguous scope block with a stable groupId ────────────────
  const productTable = firstProductTable ?? createDefaultProductTableSection();
  const scopeGroupId = productTable.groupId || crypto.randomUUID();

  const scopeBlock: PdfSection[] = [];
  if (scopeTitleSection) {
    scopeBlock.push({ ...scopeTitleSection, groupId: scopeGroupId });
  }
  if (scopeIntroSection) {
    scopeBlock.push({ ...scopeIntroSection, groupId: scopeGroupId });
  }
  scopeBlock.push({ ...productTable, groupId: scopeGroupId });

  // ── Inject missing payment-terms at the end ───────────────────────────────
  if (hasPaymentTermsCard && !firstPaymentTerms) {
    after.push(createDefaultPaymentTermsSection());
  }

  // ── Re-assemble: [before] + [scope block] + [after] ──────────────────────
  const result: PdfSection[] = [...before, ...scopeBlock, ...after];

  // ── Strip stale scope groupId from non-scope sections ────────────────────
  const scopeBlockIds = new Set(scopeBlock.map((s) => s.id));
  return result.map((s) => {
    if (scopeBlockIds.has(s.id)) return s;
    if (s.groupId === scopeGroupId) return { ...s, groupId: undefined };
    return s;
  });
}

/**
 * Returns true when the sections array needs a normalization pass.
 * Cheap check — avoids triggering useEffect on every stable render.
 */
function needsNormalization(sections: PdfSection[]): boolean {
  const productTables = sections.filter((s) => s.type === "product-table");
  const paymentTerms = sections.filter((s) => s.type === "payment-terms");
  const hasPaymentTermsCard = paymentTerms.length > 0;

  if (productTables.length !== 1) return true;
  if (hasPaymentTermsCard && paymentTerms.length !== 1) return true;

  const [pt] = productTables;

  if (pt.content !== "Sistemas / Ambientes / Produtos") return true;
  if (pt.columnWidth !== 100) return true;
  if (!pt.groupId) return true;

  if (hasPaymentTermsCard && sections.some(isPaymentTitleSection)) return true;
  if (hasPaymentTermsCard && sections.some(isPaymentTextSection)) return true;

  const scopeGroupId = pt.groupId;
  const scopeTitleSection = sections.find(isScopeTitle);
  const scopeIntroSection = sections.find(isScopeIntroText);

  if (scopeTitleSection && scopeTitleSection.groupId !== scopeGroupId)
    return true;
  if (scopeIntroSection && scopeIntroSection.groupId !== scopeGroupId)
    return true;

  const scopeIds = new Set<string>(
    [pt.id, scopeTitleSection?.id, scopeIntroSection?.id].filter(
      Boolean,
    ) as string[],
  );

  if (sections.some((s) => s.groupId === scopeGroupId && !scopeIds.has(s.id)))
    return true;

  // ── Adjacency check ───────────────────────────────────────────────────────
  // Scope block members must be physically contiguous and immediately before
  // the product-table in this order: [scopeTitle?][scopeIntroText?][product-table].
  // If they are anywhere else in the array (stale / corrupted data from old bugs)
  // needsNormalization returns true so normalizeSections can reposition them.
  const ptIdx = sections.indexOf(pt);
  let expectedIdx = ptIdx;
  if (scopeIntroSection) {
    expectedIdx -= 1;
    if (sections[expectedIdx] !== scopeIntroSection) return true;
  }
  if (scopeTitleSection) {
    expectedIdx -= 1;
    if (sections[expectedIdx] !== scopeTitleSection) return true;
  }

  return false;
}

/**
 * Repairs column-width layout only.
 * Deliberately does NOT touch groupIds or re-run normalizeSections —
 * keeping these concerns separate prevents re-normalization loops during moves.
 */
function repairColumnLayout(sections: PdfSection[]): PdfSection[] {
  return sections.map((section, index) => {
    if (section.type === "product-table") {
      const needsFix =
        section.content !== "Sistemas / Ambientes / Produtos" ||
        section.columnWidth !== 100;
      return needsFix
        ? { ...section, content: "Sistemas / Ambientes / Produtos", columnWidth: 100 }
        : section;
    }

    if (section.type === "payment-terms") {
      return section.columnWidth !== 100
        ? { ...section, columnWidth: 100 }
        : section;
    }

    if (!section.columnWidth || section.columnWidth === 100) return section;

    const prev = sections[index - 1];
    const next = sections[index + 1];
    const prevIsPartial = prev && (prev.columnWidth ?? 100) < 100;
    const nextIsPartial = next && (next.columnWidth ?? 100) < 100;

    if (!prevIsPartial && !nextIsPartial) {
      return { ...section, columnWidth: 100 };
    }
    return section;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Auto-normalize on load / when external data changes ──────────────────
  React.useEffect(() => {
    if (needsNormalization(sections)) {
      onChange(normalizeSections(sections));
    }
  }, [sections, onChange]);

  // ── Range helpers ─────────────────────────────────────────────────────────

  /**
   * Returns the index range that a section "logically owns" for the purposes
   * of move/remove operations:
   *  - product-table  → its full scope block (groupId-based, via computeProductBlockRange)
   *  - warranty/payment title → title + its paired text
   *  - everything else → just itself
   */
  const getRangeForSection = React.useCallback(
    (
      currentSections: PdfSection[],
      index: number,
    ): { start: number; end: number } => {
      const section = currentSections[index];
      if (!section) return { start: index, end: index };

      if (section.type === "product-table") {
        return computeProductBlockRange(currentSections, index);
      }

      if (isWarrantyOrPaymentGroupedTitle(section)) {
        const next = currentSections[index + 1];
        if (next?.type === "text") return { start: index, end: index + 1 };
      }

      return { start: index, end: index };
    },
    [],
  );

  // ── Structural mutations ──────────────────────────────────────────────────

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSection = (type: PdfSection["type"]) => {
    if (type === "product-table") {
      alert("Este bloco e fixo e ja existe na proposta.");
      return;
    }
    if (type === "payment-terms") {
      alert("Este bloco e gerenciado automaticamente.");
      return;
    }

    const newSection: PdfSection = {
      id: crypto.randomUUID(),
      type,
      content:
        type === "title"
          ? "Novo Titulo"
          : type === "text"
            ? "Novo paragrafo de texto..."
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

    onChange(normalizeSections([...sections, newSection]));
    setExpandedSections((prev) => new Set(prev).add(newSection.id));
  };

  const removeSection = (id: string) => {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;

    const { start, end } = getRangeForSection(sections, idx);
    const idsToRemove = new Set(sections.slice(start, end + 1).map((s) => s.id));
    const next = sections.filter((s) => !idsToRemove.has(s.id));

    onChange(normalizeSections(next));
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;

    const movingRange = getRangeForSection(sections, idx);
    const block = sections.slice(movingRange.start, movingRange.end + 1);

    if (direction === "up") {
      if (movingRange.start === 0) return;

      const anchorIdx = movingRange.start - 1;
      const targetRange = getRangeForSection(sections, anchorIdx);

      const before = sections.slice(0, targetRange.start);
      const targetBlock = sections.slice(targetRange.start, targetRange.end + 1);
      const between = sections.slice(targetRange.end + 1, movingRange.start);
      const after = sections.slice(movingRange.end + 1);

      // repairColumnLayout only — groupIds remain stable across moves
      onChange(repairColumnLayout([...before, ...block, ...targetBlock, ...between, ...after]));
      return;
    }

    // direction === "down"
    if (movingRange.end === sections.length - 1) return;

    const anchorIdx = movingRange.end + 1;
    const targetRange = getRangeForSection(sections, anchorIdx);

    const before = sections.slice(0, movingRange.start);
    const between = sections.slice(movingRange.end + 1, targetRange.start);
    const targetBlock = sections.slice(targetRange.start, targetRange.end + 1);
    const after = sections.slice(targetRange.end + 1);

    onChange(repairColumnLayout([...before, ...between, ...targetBlock, ...block, ...after]));
  };

  // ── Field updates ─────────────────────────────────────────────────────────

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
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem da secao deve ter no maximo 2MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      updateSection(id, { imageUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

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

    if (offsetX < rect.width * 0.3) setDropPlacement("left");
    else if (offsetX > rect.width * 0.7) setDropPlacement("right");
    else if (offsetY < rect.height * 0.5) setDropPlacement("top");
    else setDropPlacement("bottom");
  };

  const handleDragLeave = () => {
    setDragOverId(null);
    setDropPlacement(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedId || draggedId === targetId) return;

    const draggedIdx = sections.findIndex((s) => s.id === draggedId);
    const targetIdx = sections.findIndex((s) => s.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const movingRange = getRangeForSection(sections, draggedIdx);
    const movingBlock = sections.slice(movingRange.start, movingRange.end + 1);

    const withoutMoving = [...sections];
    withoutMoving.splice(movingRange.start, movingBlock.length);

    const adjustedTargetIdx = withoutMoving.findIndex((s) => s.id === targetId);
    if (adjustedTargetIdx === -1) return;

    const targetRange = getRangeForSection(withoutMoving, adjustedTargetIdx);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const canSideDrop =
      movingBlock.length === 1 &&
      movingBlock[0].type !== "product-table" &&
      movingBlock[0].type !== "payment-terms";
    const isSideDrop =
      canSideDrop &&
      (offsetX < rect.width * 0.3 || offsetX > rect.width * 0.7);

    const placement: "top" | "bottom" | "left" | "right" = isSideDrop
      ? offsetX < rect.width * 0.5
        ? "left"
        : "right"
      : offsetY < rect.height * 0.5
        ? "top"
        : "bottom";

    if (isSideDrop) {
      const moving = movingBlock[0];
      moving.columnWidth = 50;
      const targetSection = withoutMoving[adjustedTargetIdx];
      if (!targetSection.columnWidth || targetSection.columnWidth === 100) {
        withoutMoving[adjustedTargetIdx] = { ...targetSection, columnWidth: 50 };
      } else {
        moving.columnWidth = targetSection.columnWidth;
      }
    } else {
      movingBlock.forEach((s) => {
        s.columnWidth = 100;
      });
    }

    const insertIndex =
      placement === "bottom" || placement === "right"
        ? targetRange.end + 1
        : targetRange.start;

    withoutMoving.splice(insertIndex, 0, ...movingBlock);

    onChange(repairColumnLayout(withoutMoving));
    setDraggedId(null);
    setDragOverId(null);
    setDropPlacement(null);
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId) return;

    const draggedIdx = sections.findIndex((s) => s.id === draggedId);
    if (draggedIdx === -1) return;

    const movingRange = getRangeForSection(sections, draggedIdx);
    const block = sections.slice(movingRange.start, movingRange.end + 1);
    const rest = [...sections];
    rest.splice(movingRange.start, block.length);
    block.forEach((s) => {
      s.columnWidth = 100;
    });
    rest.push(...block);

    onChange(repairColumnLayout(rest));
    setDraggedId(null);
    setDragOverId(null);
    setDropPlacement(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setDropPlacement(null);
  };

  // ── Return ────────────────────────────────────────────────────────────────

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
