"use server";

import { revalidatePath } from "next/cache";

import { paymentSchema } from "@/lib/validations/payment";
import { parseInput, runAction } from "@/server/action-utils";
import { requireSession } from "@/server/auth";
import { registerPayment, type RegisterPaymentResult } from "@/server/services/payments";
import { prisma } from "@/lib/prisma";
import { type ActionResult, ok } from "@/types";

export async function registerPaymentAction(input: unknown): Promise<ActionResult<RegisterPaymentResult>> {
  return runAction(async () => {
    await requireSession();
    const parsed = parseInput(paymentSchema, input);
    if (!parsed.ok) return parsed.result;

    const result = await registerPayment(parsed.data);

    const loan = await prisma.loan.findUnique({
      where: { id: parsed.data.loanId },
      select: { personId: true },
    });
    revalidatePath("/pagos");
    revalidatePath("/prestamos");
    revalidatePath(`/prestamos/${parsed.data.loanId}`);
    revalidatePath("/personas");
    if (loan) revalidatePath(`/personas/${loan.personId}`);
    revalidatePath("/dashboard");
    revalidatePath("/reportes");
    revalidatePath("/finanzas");

    return ok(result);
  });
}
