import { describe, expect, it } from "vitest";

import { guessCategory } from "./categorize";

describe("guessCategory", () => {
  it("maps streaming and cloud services to SUBSCRIPTIONS", () => {
    expect(guessCategory("EXPENSE", "Pago NETFLIX.COM")).toBe("SUBSCRIPTIONS");
    expect(guessCategory("EXPENSE", "Spotify AB")).toBe("SUBSCRIPTIONS");
    expect(guessCategory("EXPENSE", "Google One almacenamiento")).toBe("SUBSCRIPTIONS");
  });

  it("maps insurance, health, education and debt keywords", () => {
    expect(guessCategory("EXPENSE", "SEGUROS SURA poliza vehiculo")).toBe("INSURANCE");
    expect(guessCategory("EXPENSE", "Mensualidad Smart Fit")).toBe("HEALTH");
    expect(guessCategory("EXPENSE", "Matricula universidad")).toBe("EDUCATION");
    expect(guessCategory("EXPENSE", "Cuota credito vehiculo")).toBe("DEBT");
  });

  it("keeps utilities as SERVICES and cinema as ENTERTAINMENT", () => {
    expect(guessCategory("EXPENSE", "Pago de servicios publicos EPM")).toBe("SERVICES");
    expect(guessCategory("EXPENSE", "Cine Colombia")).toBe("ENTERTAINMENT");
  });

  it("falls back to the generic category", () => {
    expect(guessCategory("EXPENSE", "Compra varia")).toBe("OTHER_EXPENSE");
    expect(guessCategory("INCOME", "Abono")).toBe("OTHER_INCOME");
  });

  it("does not mistake bank transfer wording or health copays for education or debt", () => {
    expect(guessCategory("EXPENSE", "Transferencia recursos propios")).toBe("OTHER_EXPENSE");
    expect(guessCategory("EXPENSE", "Concurso de fotografia")).toBe("OTHER_EXPENSE");
    expect(guessCategory("EXPENSE", "Curso de ingles")).toBe("EDUCATION");
    expect(guessCategory("EXPENSE", "Cuota moderadora EPS Sanitas")).toBe("HEALTH");
  });

  it("files the bank card fee as SERVICES, not DEBT", () => {
    expect(guessCategory("EXPENSE", "Cuota de manejo tarjeta debito")).toBe("SERVICES");
  });
});
