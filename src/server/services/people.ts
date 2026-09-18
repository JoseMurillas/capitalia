import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PersonInput } from "@/lib/validations/person";

import { NotFoundError, ServiceError } from "../errors";

const DUPLICATE_DOCUMENT = "Ya existe una persona con ese documento";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createPerson(input: PersonInput) {
  try {
    return await prisma.person.create({ data: input, select: { id: true } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ServiceError(DUPLICATE_DOCUMENT, { document: [DUPLICATE_DOCUMENT] });
    }
    throw error;
  }
}

export async function updatePerson(id: string, input: PersonInput) {
  const existing = await prisma.person.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("La persona");
  try {
    await prisma.person.update({ where: { id }, data: input });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ServiceError(DUPLICATE_DOCUMENT, { document: [DUPLICATE_DOCUMENT] });
    }
    throw error;
  }
}

export async function setPersonActive(id: string, active: boolean) {
  const person = await prisma.person.findUnique({
    where: { id },
    select: { id: true, _count: { select: { loans: { where: { status: { in: ["ACTIVE", "OVERDUE"] } } } } } },
  });
  if (!person) throw new NotFoundError("La persona");
  if (!active && person._count.loans > 0) {
    throw new ServiceError("No se puede desactivar una persona con préstamos activos o vencidos");
  }
  await prisma.person.update({ where: { id }, data: { active } });
}

export async function deletePerson(id: string) {
  const person = await prisma.person.findUnique({
    where: { id },
    select: { id: true, _count: { select: { loans: true } } },
  });
  if (!person) throw new NotFoundError("La persona");
  if (person._count.loans > 0) {
    throw new ServiceError("No se puede eliminar una persona con préstamos; desactívala en su lugar");
  }
  await prisma.person.delete({ where: { id } });
}
