"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormItem } from "@/components/shared/form-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { handleActionFailure } from "@/lib/forms";
import { type ChangePasswordInput, changePasswordSchema } from "@/lib/validations/auth";
import { changePasswordAction } from "@/server/actions/settings";

export function PasswordForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (handleActionFailure(form, result)) return;
      toast.success("Contraseña actualizada");
      form.reset();
    });
  });

  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contraseña</CardTitle>
        <CardDescription>Mínimo 8 caracteres, con al menos una letra y un número.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Contraseña actual" htmlFor="current-password" error={errors.currentPassword}>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.currentPassword)}
                {...form.register("currentPassword")}
              />
            </FormItem>
            <FormItem label="Nueva contraseña" htmlFor="new-password" error={errors.newPassword}>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.newPassword)}
                {...form.register("newPassword")}
              />
            </FormItem>
            <FormItem label="Confirmar nueva contraseña" htmlFor="confirm-password" error={errors.confirmPassword}>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...form.register("confirmPassword")}
              />
            </FormItem>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner /> : null}
                Cambiar contraseña
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
