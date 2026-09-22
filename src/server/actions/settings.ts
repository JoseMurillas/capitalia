"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { unstable_update } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema, profileSchema } from "@/lib/validations/auth";
import { reminderSettingsSchema } from "@/lib/validations/common";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { rotateInboxToken, setDefaultReminderDays } from "@/server/services/settings";
import { type ActionResult, fail, ok } from "@/types";

const BCRYPT_ROUNDS = 12;

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireSession();
    const parsed = parseInput(profileSchema, input);
    if (!parsed.ok) return parsed.result;

    try {
      await prisma.user.update({
        where: { id: session.id },
        data: { name: parsed.data.name, email: parsed.data.email },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return fail("Ese correo ya está en uso", { email: ["Ese correo ya está en uso"] });
      }
      throw error;
    }

    await unstable_update({ user: { name: parsed.data.name, email: parsed.data.email } });
    revalidatePath("/", "layout");
    return ok(undefined);
  });
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireSession();
    const parsed = parseInput(changePasswordSchema, input);
    if (!parsed.ok) return parsed.result;

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { passwordHash: true },
    });
    if (!user) return fail("Usuario no encontrado");

    const valid = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return fail("La contraseña actual no es correcta", {
        currentPassword: ["La contraseña actual no es correcta"],
      });
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: await hash(parsed.data.newPassword, BCRYPT_ROUNDS) },
    });
    return ok(undefined);
  });
}

export async function rotateInboxTokenAction(): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    await requireSession();
    const token = await rotateInboxToken();
    revalidatePath("/configuracion");
    return ok({ token });
  });
}

export async function updateReminderDaysAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(reminderSettingsSchema, input);
    if (!parsed.ok) return parsed.result;
    await setDefaultReminderDays(parsed.data.days);
    revalidatePath("/configuracion");
    revalidatePath("/finanzas/recurrentes");
    revalidatePath("/finanzas/tarjetas");
    return ok(undefined);
  });
}
