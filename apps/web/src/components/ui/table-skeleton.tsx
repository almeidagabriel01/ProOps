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
