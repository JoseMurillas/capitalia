import { describe, expect, it } from "vitest";

import { type ReminderEmailInput, renderReminderBody, renderReminderSubject } from "./render";

const BASE: ReminderEmailInput = {
  personName: "Juan Pérez",
  installmentNumber: 2,
  dueDate: "2026-09-26",
  amount: 453_333,
  loanBalance: 906_667,
  kind: "BEFORE_DUE",
  daysOverdue: null,
  signature: "Jose Murillas",
  contact: null,
};

describe("renderReminderSubject", () => {
  it("announces tomorrow's due date", () => {
    expect(renderReminderSubject(BASE)).toBe("Recordatorio: tu cuota vence mañana");
  });

  it("counts the days once it is late, in singular and plural", () => {
    expect(renderReminderSubject({ ...BASE, kind: "OVERDUE", daysOverdue: 1 })).toBe(
      "Tu cuota está vencida hace 1 día",
    );
    expect(renderReminderSubject({ ...BASE, kind: "OVERDUE", daysOverdue: 8 })).toBe(
      "Tu cuota está vencida hace 8 días",
    );
  });
});

describe("renderReminderBody", () => {
  it("writes the reminder before the due date", () => {
    expect(renderReminderBody(BASE)).toBe(
      [
        "Hola Juan Pérez,",
        "",
        "Te recordamos que la cuota 2 de tu préstamo vence el 26 de septiembre de 2026.",
        "Valor a pagar: $453.333",
        "Saldo pendiente del préstamo: $906.667",
        "",
        "Si ya realizaste el pago, ignora este mensaje.",
        "Este correo se envía automáticamente; no respondas a esta dirección.",
        "",
        "Gracias,",
        "Jose Murillas",
      ].join("\n"),
    );
  });

  it("writes the overdue reminder with the days late", () => {
    expect(renderReminderBody({ ...BASE, kind: "OVERDUE", daysOverdue: 8 })).toBe(
      [
        "Hola Juan Pérez,",
        "",
        "La cuota 2 de tu préstamo venció el 26 de septiembre de 2026, hace 8 días.",
        "Valor a pagar: $453.333",
        "Saldo pendiente del préstamo: $906.667",
        "",
        "Si ya realizaste el pago, ignora este mensaje.",
        "Este correo se envía automáticamente; no respondas a esta dirección.",
        "",
        "Gracias,",
        "Jose Murillas",
      ].join("\n"),
    );
  });

  it("says «hace 1 día» in singular", () => {
    expect(renderReminderBody({ ...BASE, kind: "OVERDUE", daysOverdue: 1 })).toContain("hace 1 día.");
  });

  it("offers the contact only when there is one", () => {
    expect(renderReminderBody({ ...BASE, contact: "3001234567" })).toContain(
      "Si necesitas hablar, escríbeme al 3001234567.",
    );
    expect(renderReminderBody(BASE)).not.toContain("Si necesitas hablar");
  });

  it("always says the mailbox does not take replies", () => {
    expect(renderReminderBody(BASE)).toContain("no respondas a esta dirección");
    expect(renderReminderBody({ ...BASE, kind: "OVERDUE", daysOverdue: 3 })).toContain(
      "no respondas a esta dirección",
    );
  });
});
