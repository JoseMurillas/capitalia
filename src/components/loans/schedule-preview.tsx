import { MoneyDisplay } from "@/components/shared/money-display";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { SchedulePreview as SchedulePreviewData } from "@/server/actions/loans";

type SchedulePreviewProps = {
  preview: SchedulePreviewData | null;
  loading: boolean;
};

export function SchedulePreview({ preview, loading }: SchedulePreviewProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Cronograma de cuotas</CardTitle>
        <CardDescription>
          Calculado en el servidor con la misma lógica que se usará al guardar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading && !preview ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : preview ? (
          <>
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Capital</p>
                <MoneyDisplay value={preview.totalPrincipal} className="font-medium" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Intereses</p>
                <MoneyDisplay value={preview.totalInterest} tone="positive" className="font-medium" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total a recibir</p>
                <MoneyDisplay value={preview.totalAmount} className="font-semibold" />
              </div>
            </div>
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <div className="max-h-96 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">Interés</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.installments.map((i) => (
                      <TableRow key={i.installmentNumber}>
                        <TableCell className="tabular-nums">{i.installmentNumber}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(i.dueDate)}</TableCell>
                        <TableCell className="text-right">
                          <MoneyDisplay value={i.principalAmount} />
                        </TableCell>
                        <TableCell className="text-right">
                          <MoneyDisplay value={i.interestAmount} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <MoneyDisplay value={i.totalAmount} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={preview.totalPrincipal} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={preview.totalInterest} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={preview.totalAmount} />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Completa monto, tasa, cuotas y fecha de inicio para ver el cronograma.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
