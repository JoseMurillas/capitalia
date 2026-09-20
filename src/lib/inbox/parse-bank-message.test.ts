import { describe, expect, it } from "vitest";

import { parseBankMessage } from "./parse-bank-message";

const RECEIVED = "2026-09-20";

const BBVA_PURCHASE = `Si no puedes ver este correo accede a la versión Web

Hola,
Jose Alejandro

Ref:13016222

En BBVA nos transformamos para poner en tus manos todas las oportunidades del mundo. A continuación encuentras el comprobante de la transacción que realizaste.

Detalles de la operación:
Tarjeta terminada en: *4793
Fecha de la operación: 2026-09-14
Establecimiento: Bodyshop muscle
Valor: $6,500.00
Hora: 18:17
Gracias por utilizar nuestros Canales Transaccionales. Bogotá: 401 00 00 Línea nacional: 01 8000 912227
© 2019 BBVA Colombia Carrera 9 #72-21, Bogotá, CO`;

describe("parseBankMessage", () => {
  it("reads a real BBVA 'Compra Exitosa' email with labelled fields", () => {
    const result = parseBankMessage({ subject: "Compra Exitosa", text: BBVA_PURCHASE, receivedDate: RECEIVED });
    expect(result).toMatchObject({
      amount: 6500,
      direction: "EXPENSE",
      description: "Bodyshop muscle",
      transactionDate: "2026-09-14",
    });
  });

  it("reads a BBVA transfer with labelled beneficiary and value", () => {
    const result = parseBankMessage({
      subject: "Transferencia Exitosa",
      text: "Detalles de la operación:\nCuenta origen: *1234\nBeneficiario: Juan Perez\nValor: $250,000.00\nFecha de la operación: 2026-09-15\nHora: 09:10",
      receivedDate: RECEIVED,
    });
    expect(result).toMatchObject({ amount: 250000, direction: "EXPENSE", description: "Juan Perez", transactionDate: "2026-09-15" });
  });

  it("reads a Bancolombia purchase alert", () => {
    const result = parseBankMessage({
      subject: "Alertas y Notificaciones",
      text: "Bancolombia le informa Compra por $45.000,00 en EXITO CALLE 80 el 20/09/2026 a las 14:33 con tarjeta *1234.",
      receivedDate: RECEIVED,
    });
    expect(result).toMatchObject({
      amount: 45000,
      direction: "EXPENSE",
      description: "EXITO CALLE 80",
      transactionDate: "2026-09-20",
      category: "FOOD",
    });
  });

  it("reads a transfer received as income", () => {
    const result = parseBankMessage({
      subject: "Transferencia recibida",
      text: "Recibiste una transferencia de MARIA GOMEZ por $700.000 el 19/09/2026.",
      receivedDate: RECEIVED,
    });
    expect(result).toMatchObject({ amount: 700000, direction: "INCOME", description: "MARIA GOMEZ", transactionDate: "2026-09-19" });
  });

  it("reads a transfer sent as an expense", () => {
    const result = parseBankMessage({
      subject: "Nequi",
      text: "Enviaste $120.000 a JUAN PEREZ desde tu Nequi. Fecha: 18 de septiembre de 2026.",
      receivedDate: RECEIVED,
    });
    expect(result).toMatchObject({ amount: 120000, direction: "EXPENSE", description: "JUAN PEREZ", transactionDate: "2026-09-18" });
  });

  it("understands amounts with COP prefix and international separators", () => {
    const result = parseBankMessage({
      subject: "Pago exitoso",
      text: "Pago de servicios publicos EPM por COP 350,000.00 realizado con exito.",
      receivedDate: RECEIVED,
    });
    expect(result).toMatchObject({ amount: 350000, direction: "EXPENSE", category: "SERVICES" });
  });

  it("falls back to the received date and the subject when nothing better is found", () => {
    const result = parseBankMessage({
      subject: "Retiro en cajero",
      text: "Retiro por $200.000 con tarjeta *9876.",
      receivedDate: RECEIVED,
    });
    expect(result).toMatchObject({ amount: 200000, direction: "EXPENSE", transactionDate: RECEIVED });
    expect(result.description).toBe("Retiro en cajero");
  });

  it("marks the direction unknown when the wording is unclear and leaves the amount null when none", () => {
    const result = parseBankMessage({
      subject: "Informacion importante",
      text: "Tu extracto ya esta disponible en la app.",
      receivedDate: RECEIVED,
    });
    expect(result.amount).toBeNull();
    expect(result.direction).toBe("UNKNOWN");
  });

  it("ignores card numbers, dates and times when looking for the amount", () => {
    const result = parseBankMessage({
      subject: "Compra",
      text: "Compra aprobada con tarjeta terminada en 4321 por $1.250.000 en ALKOSTO el 20/09/2026 10:15.",
      receivedDate: RECEIVED,
    });
    expect(result.amount).toBe(1250000);
  });
});
