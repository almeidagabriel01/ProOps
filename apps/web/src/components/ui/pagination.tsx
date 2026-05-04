"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    // Always show first page
    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    // Show surrounding pages
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    // Always show last page
    pages.push(totalPages);

    return pages;
  };

  return (
    <div
      className={cn("flex items-center justify-center gap-1 pt-4", className)}
    >
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {getPageNumbers().map((page, idx) =>
        page === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            className="h-8 w-8 p-0 text-xs"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Hook to manage pagination state.
 * Returns the current page, paginated data, total pages, and a page change handler.
 * Resets to page 1 whenever the data reference changes.
 */
export function usePagination<T>(data: T[], pageSize: number) {
  const [currentPage, setCurrentPage] = React.useState(1);

  // Reset to page 1 when data changes
  const dataLength = data.length;
  React.useEffect(() => {
    setCurrentPage(1);
  }, [dataLength]);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  // Clamp page if it goes out of bounds
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = React.useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  return {
    currentPage: safePage,
    totalPages,
    paginatedData,
    setCurrentPage,
  };
}
