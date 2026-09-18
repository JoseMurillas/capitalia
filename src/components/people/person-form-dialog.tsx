"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormItem } from "@/components/shared/form-item";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { handleActionFailure } from "@/lib/forms";
import { type PersonFormValues, type PersonInput, personSchema } from "@/lib/validations/person";
import { createPersonAction, updatePersonAction } from "@/server/actions/people";

export type PersonFormPerson = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  address: string | null;
  notes: string | null;
};

type PersonFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog edits this person instead of creating one. */
  person?: PersonFormPerson | null;
  onSaved?: (id: string) => void;
};

function toFormValues(person?: PersonFormPerson | null): PersonFormValues {
  return {
    name: person?.name ?? "",
    phone: person?.phone ?? "",
    email: person?.email ?? "",
    document: person?.document ?? "",
    address: person?.address ?? "",
    notes: person?.notes ?? "",
  };
}

export function PersonFormDialog({ open, onOpenChange, person, onSaved }: PersonFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(person);

  const form = useForm<PersonFormValues, unknown, PersonInput>({
    resolver: zodResolver(personSchema),
    defaultValues: toFormValues(person),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(person));
  }, [open, person, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      let savedId: string;
      if (person) {
        const result = await updatePersonAction(person.id, values);
        if (handleActionFailure(form, result)) return;
        savedId = person.id;
      } else {
        const result = await createPersonAction(values);
        if (handleActionFailure(form, result)) return;
        savedId = result.data.id;
      }

      toast.success(isEdit ? "Persona actualizada" : "Persona creada");
      onOpenChange(false);
      onSaved?.(savedId);
    });
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar persona" : "Nueva persona"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos de contacto de esta persona."
              : "Registra a quién le prestas dinero."}
          </DialogDescription>
        </DialogHeader>
        <form id="person-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Nombre completo" htmlFor="person-name" error={errors.name}>
              <Input id="person-name" autoFocus aria-invalid={Boolean(errors.name)} {...form.register("name")} />
            </FormItem>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem label="Documento" htmlFor="person-document" error={errors.document}>
                <Input id="person-document" aria-invalid={Boolean(errors.document)} {...form.register("document")} />
              </FormItem>
              <FormItem label="Teléfono" htmlFor="person-phone" error={errors.phone}>
                <Input id="person-phone" type="tel" aria-invalid={Boolean(errors.phone)} {...form.register("phone")} />
              </FormItem>
            </div>
            <FormItem label="Correo" htmlFor="person-email" error={errors.email}>
              <Input id="person-email" type="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
            </FormItem>
            <FormItem label="Dirección" htmlFor="person-address" error={errors.address}>
              <Input id="person-address" aria-invalid={Boolean(errors.address)} {...form.register("address")} />
            </FormItem>
            <FormItem label="Notas" htmlFor="person-notes" error={errors.notes}>
              <Textarea id="person-notes" rows={3} aria-invalid={Boolean(errors.notes)} {...form.register("notes")} />
            </FormItem>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="person-form" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {isEdit ? "Guardar cambios" : "Crear persona"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
