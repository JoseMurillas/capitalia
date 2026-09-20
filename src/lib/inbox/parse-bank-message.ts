import { guessCategory, normalizeText } from "@/lib/categorize";
import { isIsoDate } from "@/lib/dates";
import type { TransactionCategoryValue } from "@/lib/validations/transaction";

/**
 * Extracts a money movement from a bank notification (email or SMS). Banks
 * phrase these differently, so every field is best-effort and the user
 * confirms or corrects it in the inbox before it becomes a transaction.
 */

export type BankMessage = {
  subject?: string | null;
  text: string;
  /** Date the message arrived (yyyy-MM-dd), used when the text has no date. */
  receivedDate: string;
};

export type ParsedBankMessage = {
  amount: number | null;
  direction: "INCOME" | "EXPENSE" | "UNKNOWN";
  description: string;
  transactionDate: string;
  category: TransactionCategoryValue;
};

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const INCOME_WORDS = /recibiste|recibio|recibida|abono|consignacion|deposito|te enviaron|ingreso|credito a tu|acreditad|pago recibido|te pagaron/;
const EXPENSE_WORDS = /compra|pago\b|pagaste|enviaste|transferencia (enviada|exitosa|realizada)|transferiste|retiro|debito|cargo|cobro|avance|domiciliacion|suscripcion/;

// Banks that lay the receipt out as "Etiqueta: valor" lines (BBVA, Davivienda…).
const LABELLED_AMOUNT = /(?:valor|monto|importe|total)\s*(?:de la (?:compra|transaccion|operacion))?\s*:\s*(?:cop|\$)?\s*([\d.,]+)/i;
// Ordered by how specific the label is; "cuenta origen: *1234" must not win over "beneficiario".
const LABELLED_NAMES = [
  /(?:establecimiento|comercio|beneficiario|destinatario|remitente|de parte de)\s*:\s*([^\n]+)/i,
  /(?:descripcion|concepto)\s*:\s*([^\n]+)/i,
  /(?<!cuenta )(?<!cuenta de )origen\s*:\s*([^\n]+)/i,
];
const LABELLED_DATE = /fecha[^:\n]*:\s*([^\n]+)/i;

// Money: "$45.000,00", "$ 1.250.000", "COP 350,000.00", "45.000 pesos".
const MONEY = /(?:\$|cop\s?\$?|usd)\s*([\d.,]+)|([\d][\d.,]*)\s*pesos/gi;

function parseMoney(raw: string): number | null {
  const digits = raw.replace(/[^\d.,]/g, "");
  if (!/\d/.test(digits)) return null;
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    // 1.250.000,00 (Colombia)
    normalized = digits.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && /\.\d{1,2}$/.test(digits)) {
    // 350,000.00 (international)
    normalized = digits.replace(/,/g, "");
  } else {
    // 1.250.000 or 1,250,000 — separators are thousands
    normalized = digits.replace(/[.,]/g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

export function extractAmount(text: string): number | null {
  for (const match of text.matchAll(MONEY)) {
    const value = parseMoney(match[1] ?? match[2] ?? "");
    if (value !== null) return value;
  }
  return null;
}

function toIso(year: number, month: number, day: number): string | null {
  const fullYear = year < 100 ? 2000 + year : year;
  const iso = `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

export function extractDate(text: string): string | null {
  // ISO first: "2026-09-14" would otherwise be misread as 26/09/14 by the dd/MM/yy pattern.
  const iso = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(text);
  if (iso) {
    const value = toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (value) return value;
  }
  const numeric = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?!\d)/.exec(text);
  if (numeric) {
    const value = toIso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
    if (value) return value;
  }
  const spelled = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/i.exec(normalizeText(text));
  if (spelled) {
    const month = MONTHS[spelled[2]];
    if (month) return toIso(Number(spelled[3]), month, Number(spelled[1]));
  }
  return null;
}

function cleanName(value: string): string {
  return value
    .replace(/\s+(el|desde|con|por|a las|hasta)\b.*$/i, "")
    .replace(/[.,;:]+$/, "")
    .trim();
}

export function extractCounterparty(text: string, direction: ParsedBankMessage["direction"]): string | null {
  const patterns =
    direction === "INCOME"
      ? [/\bde\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .&'-]{2,60})/, /\bdesde\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .&'-]{2,60})/]
      : [/\ben\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .&'*-]{2,60})/, /\ba\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .&'-]{2,60})/];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const name = cleanName(match[1]);
      // Skip things like "a las 14:33" or dates captured as names.
      if (name.length >= 3 && !/^\d/.test(name) && !/^LAS\b/.test(name)) return name;
    }
  }
  return null;
}

/** "Etiqueta: valor" receipts keep their line breaks; read those fields before flattening. */
function extractLabelledFields(rawText: string) {
  const lines = rawText.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const amountMatch = LABELLED_AMOUNT.exec(normalizeText(lines));
  const dateMatch = LABELLED_DATE.exec(lines);

  let name: string | null = null;
  for (const pattern of LABELLED_NAMES) {
    const match = pattern.exec(lines);
    const candidate = match ? cleanName(match[1]) : "";
    // Account masks ("*1234") and bare numbers are not names.
    if (candidate.length >= 2 && !/^[*\d]/.test(candidate)) {
      name = candidate;
      break;
    }
  }

  return {
    amount: amountMatch ? parseMoney(amountMatch[1]) : null,
    name,
    date: dateMatch ? extractDate(dateMatch[1]) : null,
  };
}

export function parseBankMessage(message: BankMessage): ParsedBankMessage {
  const labelled = extractLabelledFields(message.text);
  const text = message.text.replace(/\s+/g, " ").trim();
  const normalized = normalizeText(`${message.subject ?? ""} ${text}`);

  let direction: ParsedBankMessage["direction"] = "UNKNOWN";
  if (INCOME_WORDS.test(normalized)) direction = "INCOME";
  else if (EXPENSE_WORDS.test(normalized)) direction = "EXPENSE";

  const amount = labelled.amount ?? extractAmount(text);
  const counterparty =
    (labelled.name && labelled.name.length >= 2 ? labelled.name : null) ??
    extractCounterparty(text, direction === "INCOME" ? "INCOME" : "EXPENSE");
  const description = counterparty ?? message.subject?.trim() ?? text.slice(0, 80);
  const transactionDate = labelled.date ?? extractDate(text) ?? message.receivedDate;
  const category = guessCategory(direction === "INCOME" ? "INCOME" : "EXPENSE", `${description} ${text}`);

  return { amount, direction, description: description.slice(0, 200), transactionDate, category };
}
