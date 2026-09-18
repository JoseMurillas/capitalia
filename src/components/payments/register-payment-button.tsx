"use client";

import { Banknote } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { PaymentDialog, type PaymentDialogLoan } from "./payment-dialog";

type RegisterPaymentButtonProps = {
  loans: PaymentDialogLoan[];
  defaultLoanId?: string;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
};

export function RegisterPaymentButton({
  loans,
  defaultLoanId,
  disabled,
  variant = "default",
  size = "default",
  label = "Registrar pago",
}: RegisterPaymentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} disabled={disabled || loans.length === 0} onClick={() => setOpen(true)}>
        <Banknote aria-hidden="true" />
        {label}
      </Button>
      <PaymentDialog open={open} onOpenChange={setOpen} loans={loans} defaultLoanId={defaultLoanId} />
    </>
  );
}
