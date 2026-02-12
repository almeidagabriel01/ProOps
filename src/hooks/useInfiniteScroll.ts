"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { PaginatedResult } from "@/services/client-service";

// ============================================
// TYPES
// ============================================

/** Result type for async (cursor-based) mode */
export interface AsyncInfiniteScrollResult<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
  reset: () => void;
}

/** Result type for static (array-slicing) mode */
export interface StaticInfiniteScrollResult<T> {
  displayedItems: T[];
  hasMore: boolean;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
}

/** Options for async mode */
export interface AsyncScrollOptions<T> {
  fetchPage: (
    cursor: QueryDocumentSnapshot<DocumentData> | null,
  ) => Promise<PaginatedResult<T>>;
  batchSize?: number;
  enabled?: boolean;
}

// ============================================
// ASYNC MODE (cursor-based Firestore pagination)
// ============================================

export function useAsyncInfiniteScroll<T>(
  options: AsyncScrollOptions<T>,
): AsyncInfiniteScrollResult<T> {
  const { fetchPage, batchSize = 12, enabled = true } = options;

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isFetchingRef = useRef(false);
  const fetchPageRef = useRef(fetchPage);

  // Keep fetchPage ref up to date
  fetchPageRef.current = fetchPage;

  // Initial load
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadInitial = async () => {
      setIsLoading(true);
      setItems([]);
      cursorRef.current = null;
      setHasMore(true);

      try {
        const result = await fetchPageRef.current(null);
        if (cancelled) return;

        setItems(result.data);
        cursorRef.current = result.lastDoc;
        setHasMore(result.hasMore);
      } catch (error) {
        console.error("Error loading initial page:", error);
        if (!cancelled) setHasMore(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadInitial();

    return () => {
      cancelled = true;
    };
    // We only re-fetch on initial mount or when `enabled` changes.
    // fetchPage identity changes are handled via ref.
  }, [enabled, batchSize]);

  // Load more
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore) return;
    isFetchingRef.current = true;
    setIsLoadingMore(true);

    try {
      const result = await fetchPageRef.current(cursorRef.current);
      setItems((prev) => [...prev, ...result.data]);
      cursorRef.current = result.lastDoc;
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error loading more:", error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [hasMore]);

  // IntersectionObserver
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!hasMore || isLoading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px", threshold: 0 },
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, isLoading, loadMore]);

  // Reset: clear items and re-fetch first page
  const reset = useCallback(() => {
    setItems([]);
    cursorRef.current = null;
    setHasMore(true);
    setIsLoading(true);

    fetchPageRef
      .current(null)
      .then((result) => {
        setItems(result.data);
        cursorRef.current = result.lastDoc;
        setHasMore(result.hasMore);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error resetting:", error);
        setHasMore(false);
        setIsLoading(false);
      });
  }, []);

  return { items, isLoading, isLoadingMore, hasMore, sentinelRef, reset };
}

// ============================================
// STATIC MODE (backwards compatible — slices a full array)
// ============================================

/**
 * Hook for infinite scroll (lazy load).
 *
 * Progressively reveals items from a full dataset as the user scrolls down.
 * Uses IntersectionObserver to detect when the sentinel element is visible.
 *
 * @param data      - The complete dataset (already fetched).
 * @param batchSize - How many items to reveal per scroll trigger.
 * @returns displayedItems, hasMore, sentinelRef
 */
export function useInfiniteScroll<T>(
  data: T[],
  batchSize: number = 10,
): StaticInfiniteScrollResult<T> {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset when data changes (filters, search, etc.)
  // We use the render-update pattern to clean state during render
  const [prevDataLength, setPrevDataLength] = useState(data.length);

  if (data.length !== prevDataLength) {
    setPrevDataLength(data.length);
    setVisibleCount(batchSize);
  }

  const hasMore = visibleCount < data.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + batchSize, data.length));
  }, [batchSize, data.length]);

  // Set up IntersectionObserver
  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          loadMore();
        }
      },
      {
        rootMargin: "200px", // Start loading before the sentinel is visible
        threshold: 0,
      },
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loadMore]);

  const displayedItems = data.slice(0, visibleCount);

  return {
    displayedItems,
    hasMore,
    sentinelRef,
  };
}
