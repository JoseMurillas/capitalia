import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { sumMoney, toNumber } from "@/lib/calculations";
import { fromIsoDate, type IsoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, pageCountFor, paginate } from "@/lib/search-params";
import { requireSession } from "@/server/auth";
import type { PaginatedResult } from "@/types";

import { type PaymentDto, paymentInclude, toPaymentDto } from "./loan-dto";

export type PaymentListParams = {
  from?: IsoDate;
  to?: IsoDate;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type PaymentListTotals = {
  amount: number;
  interest: number;
  principal: number;
  count: number;
};

export async function listPayments(
  params: PaymentListParams = {},
): Promise<PaginatedResult<PaymentDto> & { totals: PaymentListTotals }> {
  await requireSession();

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const where: Prisma.PaymentWhereInput = {
    ...(params.from || params.to
      ? {
          paymentDate: {
            ...(params.from ? { gte: fromIsoDate(params.from) } : {}),
            ...(params.to ? { lte: fromIsoDate(params.to) } : {}),
          },
        }
      : {}),
    ...(params.q
      ? {
          loan: {
            person: {
              OR: [
                { name: { contains: params.q, mode: "insensitive" } },
                { document: { contains: params.q, mode: "insensitive" } },
              ],
            },
          },
        }
      : {}),
  };

  const [total, payments, aggregate] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      ...paginate(page, pageSize),
    }),
    prisma.payment.aggregate({
      where,
      _sum: { amount: true, interestPaid: true, principalPaid: true },
    }),
  ]);

  return {
    items: payments.map(toPaymentDto),
    total,
    page,
    pageSize,
    pageCount: pageCountFor(total, pageSize),
    totals: {
      amount: toNumber(sumMoney([aggregate._sum.amount ?? 0])),
      interest: toNumber(sumMoney([aggregate._sum.interestPaid ?? 0])),
      principal: toNumber(sumMoney([aggregate._sum.principalPaid ?? 0])),
      count: total,
    },
  };
}
