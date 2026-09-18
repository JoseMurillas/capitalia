"use client";

import { Eye, MoreHorizontal, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deletePersonAction, setPersonActiveAction } from "@/server/actions/people";

import { PersonFormDialog, type PersonFormPerson } from "./person-form-dialog";

type PersonActionsProps = {
  person: PersonFormPerson & { active: boolean };
  /** Hide the "Ver detalle" entry when already on the detail page. */
  showView?: boolean;
  /** After deleting from the detail page we navigate back to the list. */
  redirectAfterDelete?: boolean;
  triggerVariant?: "icon" | "button";
};

export function PersonActions({
  person,
  showView = true,
  redirectAfterDelete = false,
  triggerVariant = "icon",
}: PersonActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  const toggleActive = async () => {
    const result = await setPersonActiveAction(person.id, !person.active);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(person.active ? "Persona desactivada" : "Persona activada");
  };

  const remove = async () => {
    const result = await deletePersonAction(person.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Persona eliminada");
    if (redirectAfterDelete) router.push("/personas");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {triggerVariant === "icon" ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${person.name}`}>
              <MoreHorizontal />
            </Button>
          ) : (
            <Button variant="outline">
              Acciones
              <MoreHorizontal aria-hidden="true" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showView ? (
            <DropdownMenuItem asChild>
              <Link href={`/personas/${person.id}`}>
                <Eye aria-hidden="true" />
                Ver detalle
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil aria-hidden="true" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setToggleOpen(true)}>
            {person.active ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
            {person.active ? "Desactivar" : "Activar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PersonFormDialog open={editOpen} onOpenChange={setEditOpen} person={person} />

      <ConfirmDialog
        open={toggleOpen}
        onOpenChange={setToggleOpen}
        title={person.active ? "¿Desactivar persona?" : "¿Activar persona?"}
        description={
          person.active
            ? "Una persona inactiva no aparecerá al crear préstamos. Sus préstamos e historial se conservan."
            : "La persona volverá a estar disponible para nuevos préstamos."
        }
        confirmLabel={person.active ? "Desactivar" : "Activar"}
        onConfirm={toggleActive}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar persona?"
        description="Esta acción no se puede deshacer. Solo es posible si la persona no tiene préstamos."
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
