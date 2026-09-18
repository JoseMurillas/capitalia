import { MoneyDisplay } from "@/components/shared/money-display";
import { InstallmentStatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { InstallmentDto } from "@/server/queries/loan-dto";

type InstallmentsTableProps = {
  installments: InstallmentDto[];
};

export function InstallmentsTable({ installments }: InstallmentsTableProps) {
  const totals = installments.reduce(
    (acc, i) => ({
      principal: acc.principal + i.principalAmount,
      interest: acc.interest + i.interestAmount,
      total: acc.total + i.totalAmount,
      paid: acc.paid + i.paidAmount,
    }),
    { principal: 0, interest: 0, total: 0, paid: 0 },
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Interés</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((i) => (
                <TableRow
                  key={i.id}
                  className={cn(i.status === "OVERDUE" && "bg-red-50/60 dark:bg-red-950/20")}
                >
                  <TableCell className="tabular-nums">{i.installmentNumber}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(i.dueDate)}
                    {i.paidAt ? (
                      <span className="block text-xs text-muted-foreground">Pagada {formatDate(i.paidAt)}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={i.principalAmount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={i.interestAmount} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyDisplay value={i.totalAmount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={i.paidAmount} tone={i.paidAmount > 0 ? "positive" : "muted"} />
                    {i.status === "PARTIAL" || i.status === "OVERDUE" ? (
                      <span className="block text-xs text-muted-foreground">
                        Faltan <MoneyDisplay value={i.pendingAmount} />
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <InstallmentStatusBadge status={i.status} />
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Totales</TableCell>
              <TableCell className="text-right">
                <MoneyDisplay value={totals.principal} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyDisplay value={totals.interest} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyDisplay value={totals.total} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyDisplay value={totals.paid} />
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
