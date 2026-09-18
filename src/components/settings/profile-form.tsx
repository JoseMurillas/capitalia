"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { type ProfileInput, profileSchema } from "@/lib/validations/auth";
import { updateProfileAction } from "@/server/actions/settings";

type ProfileFormProps = {
  user: { name: string; email: string };
};

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (handleActionFailure(form, result)) return;
      toast.success("Perfil actualizado");
      form.reset(values);
      router.refresh();
    });
  });

  const { errors, isDirty } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>Nombre y correo con el que inicias sesión.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormItem label="Nombre" htmlFor="profile-name" error={errors.name}>
              <Input id="profile-name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
            </FormItem>
            <FormItem label="Correo" htmlFor="profile-email" error={errors.email}>
              <Input id="profile-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
            </FormItem>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending || !isDirty}>
                {isPending ? <Spinner /> : null}
                Guardar cambios
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
