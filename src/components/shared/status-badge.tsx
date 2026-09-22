import type { InstallmentStatus, LoanStatus, TransactionType } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import type { CommitmentStatus } from "@/lib/calculations/commitments";
import {
  COMMITMENT_STATUS_LABELS,
  INSTALLMENT_STATUS_LABELS,
  LOAN_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  success:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  warning:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  info: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
};

type StatusBadgeProps = {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
};

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(toneClasses[tone], className)}>
      {children}
    </Badge>
  );
}

const loanTones: Record<LoanStatus, BadgeTone> = {
  ACTIVE: "info",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

export function LoanStatusBadge({ status, className }: { status: LoanStatus; className?: string }) {
  return (
    <StatusBadge tone={loanTones[status]} className={className}>
      {LOAN_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

const installmentTones: Record<InstallmentStatus, BadgeTone> = {
  PENDING: "neutral",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

export function InstallmentStatusBadge({
  status,
  className,
}: {
  status: InstallmentStatus;
  className?: string;
}) {
  return (
    <StatusBadge tone={installmentTones[status]} className={className}>
      {INSTALLMENT_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function TransactionTypeBadge({ type, className }: { type: TransactionType; className?: string }) {
  return (
    <StatusBadge tone={type === "INCOME" ? "success" : "danger"} className={className}>
      {TRANSACTION_TYPE_LABELS[type]}
    </StatusBadge>
  );
}

export function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <StatusBadge tone={active ? "success" : "neutral"} className={className}>
      {active ? "Activa" : "Inactiva"}
    </StatusBadge>
  );
}

const commitmentTones: Record<CommitmentStatus, BadgeTone> = {
  OVERDUE: "danger",
  DUE_TODAY: "danger",
  ALERT: "warning",
  UPCOMING: "neutral",
};

export function CommitmentStatusBadge({ status, className }: { status: CommitmentStatus; className?: string }) {
  return (
    <StatusBadge tone={commitmentTones[status]} className={className}>
      {COMMITMENT_STATUS_LABELS[status]}
    </StatusBadge>
  );
}
