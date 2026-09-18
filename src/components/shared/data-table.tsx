import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<Row> = {
  key: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  /** Applied to both header and body cells (alignment, width, visibility). */
  className?: string;
  headerClassName?: string;
};

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  /** Rendered instead of the table when there are no rows. */
  emptyState: React.ReactNode;
  rowClassName?: (row: Row) => string | undefined;
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Presentational table shared by every list in the app. Data comes already
 * filtered and paginated from the server; this only renders it.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  emptyState,
  rowClassName,
  footer,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn("whitespace-nowrap", column.className, column.headerClassName)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowId(row)} className={rowClassName?.(row)}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {footer}
        </Table>
      </div>
    </div>
  );
}
