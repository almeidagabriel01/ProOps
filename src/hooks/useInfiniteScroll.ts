"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
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
  isLoadingMore: boolean;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
}

export interface StaticScrollOptions {
  requireUserScroll?: boolean;
  rootMargin?: string;
  threshold?: number;
  loadDelayMs?: number;
  allowAutoLoadUntilScrollable?: boolean;
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
  options: StaticScrollOptions = {},
): StaticInfiniteScrollResult<T> {
  const {
    requireUserScroll = false,
    rootMargin = "200px",
    threshold = 0,
    loadDelayMs = 0,
    allowAutoLoadUntilScrollable = true,
  } = options;

  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userHasScrolledRef = useRef(!requireUserScroll);
  const isLoadingMoreRef = useRef(false);
  const isSentinelVisibleRef = useRef(false);

  useEffect(() => {
    startTransition(() => {
      setVisibleCount(batchSize);
      setIsLoadingMore(false);
    });
    isLoadingMoreRef.current = false;
    isSentinelVisibleRef.current = false;
  }, [data.length, batchSize]);

  useEffect(() => {
    userHasScrolledRef.current = !requireUserScroll;

    if (!requireUserScroll) return;

    const unlockLoading = () => {
      if (!userHasScrolledRef.current) {
        userHasScrolledRef.current = true;
      }
    };

    const unlockIfNotScrollable = () => {
      if (!allowAutoLoadUntilScrollable) return;

      const doc = document.documentElement;
      if (doc.scrollHeight <= window.innerHeight + 16) {
        unlockLoading();
      }
    };

    const handleScroll = () => {
      if (window.scrollY > 24) {
        unlockLoading();
      }
    };

    const handleWheel = () => {
      unlockLoading();
    };

    const handleTouchMove = () => {
      unlockLoading();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", "End", " "].includes(event.key)) {
        unlockLoading();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", unlockIfNotScrollable);

    unlockIfNotScrollable();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", unlockIfNotScrollable);
    };
  }, [requireUserScroll, allowAutoLoadUntilScrollable]);

  const hasMore = visibleCount < data.length;

  const loadMore = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMore) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + batchSize, data.length));
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }, loadDelayMs);
  }, [batchSize, data.length, hasMore, loadDelayMs]);

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
        if (!entry) return;

        isSentinelVisibleRef.current = entry.isIntersecting;

        if (!entry.isIntersecting) {
          return;
        }

        if (!userHasScrolledRef.current) return;
        if (isLoadingMoreRef.current) return;

        loadMore();
      },
      {
        rootMargin,
        threshold,
      },
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loadMore, rootMargin, threshold]);

  useEffect(() => {
    if (!hasMore) return;
    if (!isSentinelVisibleRef.current) return;
    if (isLoadingMoreRef.current) return;
    if (requireUserScroll && !userHasScrolledRef.current) return;

    const timeoutId = window.setTimeout(() => {
      loadMore();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [visibleCount, hasMore, requireUserScroll, loadMore]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const displayedItems = data.slice(0, visibleCount);

  return {
    displayedItems,
    hasMore,
    isLoadingMore,
    sentinelRef,
  };
}
