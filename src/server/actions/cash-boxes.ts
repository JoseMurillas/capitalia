"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  cashBoxAdjustmentSchema,
  cashBoxMovementSchema,
  cashBoxSchema,
  cashBoxTransferSchema,
  createCashBoxSchema,
} from "@/lib/validations/cash-box";
import { idSchema } from "@/lib/validations/common";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import {
  adjustCashBox,
  createCashBox,
  deleteCashBox,
  depositToCashBox,
  setCashBoxActive,
  transferBetweenCashBoxes,
  updateCashBox,
  withdrawFromCashBox,
} from "@/server/services/cash-boxes";
import { type ActionResult, fail, ok } from "@/types";

function revalidateCashBoxes(id?: string) {
  revalidatePath("/prestamos/cajas");
  revalidatePath("/prestamos");
  revalidatePath("/dashboard");
  revalidatePath("/finanzas");
  if (id) revalidatePath(`/prestamos/cajas/${id}`);
}

/** Prisma's unique-constraint code, surfaced under the name field. */
function isDuplicateName(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createCashBoxAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(createCashBoxSchema, input);
    if (!parsed.ok) return parsed.result;
    try {
      const created = await createCashBox(parsed.data);
      revalidateCashBoxes();
      return ok({ id: created.id });
    } catch (error) {
      if (isDuplicateName(error)) return fail("Ya existe una caja con ese nombre", { name: ["Nombre en uso"] });
      throw error;
    }
  });
}

export async function updateCashBoxAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(cashBoxSchema, input);
    if (!parsed.ok) return parsed.result;
    try {
      await updateCashBox(parsedId.data, parsed.data);
    } catch (error) {
      if (isDuplicateName(error)) return fail("Ya existe una caja con ese nombre", { name: ["Nombre en uso"] });
      throw error;
    }
    revalidateCashBoxes(parsedId.data);
    return ok(undefined);
  });
}

export async function setCashBoxActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsedActive = parseInput(z.boolean(), active);
    if (!parsedActive.ok) return parsedActive.result;
    await setCashBoxActive(parsedId.data, parsedActive.data);
    revalidateCashBoxes(parsedId.data);
    return ok(undefined);
  });
}

export async function deleteCashBoxAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await deleteCashBox(parsedId.data);
    revalidateCashBoxes();
    return ok(undefined);
  });
}

export async function depositToCashBoxAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(cashBoxMovementSchema, input);
    if (!parsed.ok) return parsed.result;
    await depositToCashBox(parsedId.data, parsed.data);
    revalidateCashBoxes(parsedId.data);
    return ok(undefined);
  });
}

export async function withdrawFromCashBoxAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(cashBoxMovementSchema, input);
    if (!parsed.ok) return parsed.result;
    await withdrawFromCashBox(parsedId.data, parsed.data);
    revalidateCashBoxes(parsedId.data);
    return ok(undefined);
  });
}

export async function transferBetweenCashBoxesAction(fromId: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, fromId);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(cashBoxTransferSchema, input);
    if (!parsed.ok) return parsed.result;
    await transferBetweenCashBoxes(parsedId.data, parsed.data);
    revalidateCashBoxes(parsedId.data);
    revalidatePath(`/prestamos/cajas/${parsed.data.toCashBoxId}`);
    return ok(undefined);
  });
}

export async function adjustCashBoxAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(cashBoxAdjustmentSchema, input);
    if (!parsed.ok) return parsed.result;
    await adjustCashBox(parsedId.data, parsed.data);
    revalidateCashBoxes(parsedId.data);
    return ok(undefined);
  });
}
