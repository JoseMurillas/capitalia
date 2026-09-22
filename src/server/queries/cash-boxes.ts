import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CashBoxCounterparty, CashBoxMovementKind, LoanStatus } from "@/generated/prisma/enums";
import { cashBoxBalance, outstandingPrincipal, runningBalance, sumMoney, toNumber } from "@/lib/calculations";
import { type IsoDate, toIsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth";

export type CashBoxDto = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  /** Money sitting in the box, ready to lend. */
  available: number;
  /** Capital of this box currently out in loans. */
  lentOut: number;
  /** available + lentOut: everything this box owns. */
  total: number;
  activeLoans: number;
  interestEarned: number;
  movementsCount: number;
};

export type CashBoxOption = { id: string; name: string; available: number };

export type CashBoxLoanDto = {
  id: string;
  personId: string;
  personName: string;
  principalAmount: number;
  principalBalance: number;
  status: LoanStatus;
  startDate: IsoDate;
};

export type CashBoxMovementDto = {
  id: string;
  kind: CashBoxMovementKind;
  /** Signed: positive entered the box, negative left it. */
  amount: number;
  /** Box balance right after this movement. */
  balance: number;
  movementDate: IsoDate;
  description: string;
  notes: string | null;
  counterparty: CashBoxCounterparty | null;
  relatedCashBoxId: string | null;
  relatedCashBoxName: string | null;
  loanId: string | null;
  paymentId: string | null;
};

export type CashBoxDetailDto = CashBoxDto & { loans: CashBoxLoanDto[]; movements: CashBoxMovementDto[] };

export type CashBoxesSummary = {
  count: number;
  totalAvailable: number;
  totalLent: number;
  totalCapital: number;
  interestEarned: number;
};

const cashBoxInclude = {
  movements: { select: { amount: true } },
  loans: {
    select: {
      id: true,
      status: true,
      principalAmount: true,
      installments: { select: { principalPaid: true } },
      payments: { select: { interestPaid: true } },
    },
  },
  _count: { select: { movements: true } },
} satisfies Prisma.CashBoxInclude;

type CashBoxRow = Prisma.CashBoxGetPayload<{ include: typeof cashBoxInclude }>;

function toDto(box: CashBoxRow): CashBoxDto {
  const available = cashBoxBalance(box.movements);
  const lentOut = outstandingPrincipal(
    box.loans.map((loan) => ({
      principalAmount: loan.principalAmount,
      principalPaid: sumMoney(loan.installments.map((i) => i.principalPaid)),
      status: loan.status,
    })),
  );
  const interestEarned = sumMoney(box.loans.flatMap((loan) => loan.payments.map((p) => p.interestPaid)));

  return {
    id: box.id,
    name: box.name,
    description: box.description,
    active: box.active,
    available: toNumber(available),
    lentOut: toNumber(lentOut),
    total: toNumber(available.plus(lentOut)),
    activeLoans: box.loans.filter((loan) => loan.status === "ACTIVE" || loan.status === "OVERDUE").length,
    interestEarned: toNumber(interestEarned),
    movementsCount: box._count.movements,
  };
}

export async function listCashBoxes(): Promise<CashBoxDto[]> {
  await requireSession();
  const boxes = await prisma.cashBox.findMany({
    include: cashBoxInclude,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return boxes.map(toDto);
}

/** Active boxes with their available balance, for the loan form and transfers. */
export async function listCashBoxOptions(): Promise<CashBoxOption[]> {
  await requireSession();
  const boxes = await prisma.cashBox.findMany({
    where: { active: true },
    select: { id: true, name: true, movements: { select: { amount: true } } },
    orderBy: { name: "asc" },
  });
  return boxes.map((box) => ({
    id: box.id,
    name: box.name,
    available: toNumber(cashBoxBalance(box.movements)),
  }));
}

export async function getCashBoxDetail(id: string): Promise<CashBoxDetailDto | null> {
  await requireSession();
  const box = await prisma.cashBox.findUnique({
    where: { id },
    include: {
      ...cashBoxInclude,
      loans: {
        ...cashBoxInclude.loans,
        select: {
          ...cashBoxInclude.loans.select,
          startDate: true,
          person: { select: { id: true, name: true } },
        },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!box) return null;

  const [movements, relatedBoxes] = await Promise.all([
    prisma.cashBoxMovement.findMany({
      where: { cashBoxId: id },
      orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.cashBox.findMany({ select: { id: true, name: true } }),
  ]);
  const names = new Map(relatedBoxes.map((b) => [b.id, b.name]));

  return {
    ...toDto(box),
    loans: box.loans.map((loan) => ({
      id: loan.id,
      personId: loan.person.id,
      personName: loan.person.name,
      principalAmount: toNumber(loan.principalAmount),
      principalBalance: toNumber(
        outstandingPrincipal([
          {
            principalAmount: loan.principalAmount,
            principalPaid: sumMoney(loan.installments.map((i) => i.principalPaid)),
            status: loan.status,
          },
        ]),
      ),
      status: loan.status,
      startDate: toIsoDate(loan.startDate),
    })),
    // Newest first for reading, but the running balance is computed oldest first.
    movements: runningBalance(movements)
      .map((movement) => ({
        id: movement.id,
        kind: movement.kind,
        amount: toNumber(movement.amount),
        balance: toNumber(movement.balance),
        movementDate: toIsoDate(movement.movementDate),
        description: movement.description,
        notes: movement.notes,
        counterparty: movement.counterparty,
        relatedCashBoxId: movement.relatedCashBoxId,
        relatedCashBoxName: movement.relatedCashBoxId ? (names.get(movement.relatedCashBoxId) ?? null) : null,
        loanId: movement.loanId,
        paymentId: movement.paymentId,
      }))
      .reverse(),
  };
}

export async function getCashBoxesSummary(): Promise<CashBoxesSummary> {
  const boxes = (await listCashBoxes()).filter((box) => box.active);
  return {
    count: boxes.length,
    totalAvailable: toNumber(sumMoney(boxes.map((b) => b.available))),
    totalLent: toNumber(sumMoney(boxes.map((b) => b.lentOut))),
    totalCapital: toNumber(sumMoney(boxes.map((b) => b.total))),
    interestEarned: toNumber(sumMoney(boxes.map((b) => b.interestEarned))),
  };
}
