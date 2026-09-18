"use server";

import { revalidatePath } from "next/cache";

import { idSchema } from "@/lib/validations/common";
import { personSchema } from "@/lib/validations/person";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import {
  createPerson,
  deletePerson,
  setPersonActive,
  updatePerson,
} from "@/server/services/people";
import { type ActionResult, ok } from "@/types";

function revalidatePeople(id?: string) {
  revalidatePath("/personas");
  if (id) revalidatePath(`/personas/${id}`);
  revalidatePath("/prestamos/nuevo");
}

export async function createPersonAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(personSchema, input);
    if (!parsed.ok) return parsed.result;
    const person = await createPerson(parsed.data);
    revalidatePeople();
    return ok({ id: person.id });
  });
}

export async function updatePersonAction(id: unknown, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    const parsed = parseInput(personSchema, input);
    if (!parsed.ok) return parsed.result;
    await updatePerson(parsedId.data, parsed.data);
    revalidatePeople(parsedId.data);
    return ok(undefined);
  });
}

export async function setPersonActiveAction(id: unknown, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await setPersonActive(parsedId.data, active === true);
    revalidatePeople(parsedId.data);
    return ok(undefined);
  });
}

export async function deletePersonAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsedId = parseInput(idSchema, id);
    if (!parsedId.ok) return parsedId.result;
    await deletePerson(parsedId.data);
    revalidatePeople(parsedId.data);
    return ok(undefined);
  });
}
