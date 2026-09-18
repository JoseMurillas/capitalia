"use client";

import { Ban, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cancelLoanAction, deleteLoanAction, updateLoanNotesAction } from "@/server/actions/loans";
import type { LoanDetail } from "@/server/queries/loans";

type LoanActionsProps = {
  loan: Pick<LoanDetail, "id" | "status" | "notes" | "paymentCount">;
};

export function LoanActions({ loan }: LoanActionsProps) {
  const router = useRouter();
  const [notesOpen, setNotesOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notes, setNotes] = useState(loan.notes ?? "");
  const [isPending, startTransition] = useTransition();

  const canCancel = (loan.status === "ACTIVE" || loan.status === "OVERDUE") && loan.paymentCount === 0;
  const canDelete = loan.paymentCount === 0;

  const saveNotes = () =>
    startTransition(async () => {
      const result = await updateLoanNotesAction(loan.id, notes);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Notas actualizadas");
      setNotesOpen(false);
    });

  const cancel = async () => {
    const result = await cancelLoanAction(loan.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Préstamo cancelado");
  };

  const remove = async () => {
    const result = await deleteLoanAction(loan.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Préstamo eliminado");
    router.push("/prestamos");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Más acciones">
            Acciones
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setNotes(loan.notes ?? "");
              setNotesOpen(true);
            }}
          >
            <Pencil aria-hidden="true" />
            Editar notas
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canCancel} onSelect={() => setCancelOpen(true)}>
            <Ban aria-hidden="true" />
            Cancelar préstamo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={!canDelete} onSelect={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={notesOpen} onOpenChange={isPending ? undefined : setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas del préstamo</DialogTitle>
            <DialogDescription>Acuerdos, garantías o cualquier detalle útil.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="loan-notes-edit">Notas</Label>
            <Textarea
              id="loan-notes-edit"
              rows={5}
              value={notes}
              maxLength={1000}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={saveNotes} disabled={isPending}>
              {isPending ? <Spinner /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="¿Cancelar este préstamo?"
        description="El préstamo quedará como cancelado y dejará de contar en las métricas. Solo es posible cuando no tiene pagos."
        confirmLabel="Cancelar préstamo"
        destructive
        onConfirm={cancel}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar este préstamo?"
        description="Se eliminarán también sus cuotas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
