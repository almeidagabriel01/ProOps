import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
  rowCount?: number;
  columnCount?: number;
  showActions?: boolean;
}

export function TableSkeleton({
  rowCount = 5,
  columnCount = 4,
  showActions = true,
}: TableSkeletonProps) {
  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columnCount }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-[100px]" />
              </TableHead>
            ))}
            {showActions && (
              <TableHead className="text-right">
                <Skeleton className="ml-auto h-4 w-[50px]" />
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: columnCount }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface DataTableCardsSkeletonProps {
  rowCount?: number;
  /** Secondary label/value pairs shown under the headline. */
  fieldCount?: number;
}

/**
 * Mobile counterpart of the per-route table skeletons: mirrors the card layout
 * `DataTable` renders below `md`, so the skeleton keeps the shape of what
 * actually arrives.
 */
export function DataTableCardsSkeleton({
  rowCount = 6,
  fieldCount = 2,
}: DataTableCardsSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-8 shrink-0" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {Array.from({ length: fieldCount }).map((_, j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
