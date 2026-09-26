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
  /** NOTICE = login alerts, security warnings, marketing: nothing to record. */
  kind: "TRANSACTION" | "NOTICE";
  amount: number | null;
  direction: "INCOME" | "EXPENSE" | "UNKNOWN";
  description: string;
  /** Who received the money, or who sent it. Null when the message never says. */
  counterparty: string | null;
  transactionDate: string;
  category: TransactionCategoryValue;
};

// Subjects/bodies that never describe a money movement.
const NOTICE_PATTERNS =
  /confirmacion de ingreso en nuestros canales|iniciaste otra sesion|inicio de sesion|ingreso a bbva net|clave dinamica|codigo de verificacion|codigo de seguridad|cambio de clave|actualiza tus datos|actualizacion de datos|extracto (ya )?(esta )?disponible|encuesta|te invitamos|nueva version de la app/;

// The subject is the most reliable hint; the body is only a fallback.
const INCOME_SUBJECT = /recibiste|recibid|recibio|abono|consignacion|deposito|te enviaron|te pagaron|dinero en tu cuenta/;
const EXPENSE_SUBJECT = /compra|envio|enviaste|pago|retiro|transferencia|debito|cargo|cobro|avance/;

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const INCOME_WORDS = /recibiste|recibio|recibida|abono|consignacion|deposito|te enviaron|ingreso de dinero|credito a tu|acreditad|pago recibido|te pagaron/;
const EXPENSE_WORDS = /compra|pago\b|pagaste|enviaste|tu envio|transferencia (enviada|exitosa|realizada)|transferiste|retiro|debito|cargo|cobro|avance|domiciliacion|suscripcion/;

// Banks that lay the receipt out as "Etiqueta: valor" lines (BBVA, Davivienda…).
const LABELLED_AMOUNT = /(?:valor|monto|importe|total)\s*(?:de la (?:compra|transaccion|operacion))?\s*:\s*(?:cop|\$)?\s*([\d.,]+)/i;
// Ordered by how specific the label is; "cuenta origen: *1234" must not win over "beneficiario".
const LABELLED_NAMES = [
  /(?:establecimiento|comercio|beneficiario|destinatario|remitente|de parte de)\s*:\s*([^\n]+)/i,
  /(?:descripcion|concepto)\s*:\s*([^\n]+)/i,
  /(?<!cuenta )(?<!cuenta de )origen\s*:\s*([^\n]+)/i,
];
const LABELLED_DATE = /fecha[^:\n]*:\s*([^\n]+)/i;

// Bre-B receipts drop the colon and put the value on the next line:
//   Persona que recibe
//   *Jose Alejandro Murillas Zuñiga*
// Matching is exact, so "Valor: $6.500" stays with the "Etiqueta: valor" reader
// above and only a bare label picks up the line below it.
const STACKED_COUNTERPARTY = [
  "persona que recibe",
  "persona que envia",
  "beneficiario",
  "destinatario",
  "remitente",
  "nombre del comercio",
  "comercio",
  "establecimiento",
  // The wallet or bank, which is a poorer answer than a person but better than none.
  "entidad que recibe",
];
const STACKED_AMOUNT = ["valor enviado", "valor recibido", "valor", "monto", "importe", "total"];
const STACKED_DATE = ["fecha y hora", "fecha de la operacion", "fecha"];

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
  // Year first: "2026-09-14" and "2026/09/26" would otherwise be misread as
  // day-first by the dd/MM/yy pattern below.
  const iso = /(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/.exec(text);
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

/**
 * Reads the "label on one line, value on the next" layout. Only the labels
 * listed above are looked up, so an ordinary sentence followed by another one
 * can never be mistaken for a field.
 */
function extractStackedFields(rawText: string) {
  const lines = rawText.replace(/\r/g, "").split("\n");
  const found = new Map<string, string>();

  for (let i = 0; i < lines.length - 1; i += 1) {
    const label = normalizeText(lines[i].replace(/[*:]/g, " "));
    if (!label || found.has(label)) continue;
    // Bold markers survive the conversion to plain text; the value keeps the rest.
    const value = lines[i + 1].replace(/\*/g, "").replace(/[.,;:]+$/, "").trim();
    if (value) found.set(label, value);
  }

  const pick = (labels: string[]) => {
    for (const label of labels) {
      const value = found.get(label);
      if (value) return value;
    }
    return null;
  };

  const name = pick(STACKED_COUNTERPARTY);
  const amount = pick(STACKED_AMOUNT);
  const date = pick(STACKED_DATE);

  return {
    // Account masks and codes are not names.
    name: name && name.length >= 3 && /[a-záéíóúñ]/i.test(name) && !/^\d/.test(name) ? name : null,
    amount: amount ? parseMoney(amount) : null,
    date: date ? extractDate(date) : null,
  };
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
  const stacked = extractStackedFields(message.text);
  const text = message.text.replace(/\s+/g, " ").trim();
  const subject = normalizeText(message.subject ?? "");
  const normalized = normalizeText(`${message.subject ?? ""} ${text}`);
  const transactionDate = labelled.date ?? stacked.date ?? extractDate(text) ?? message.receivedDate;

  if (NOTICE_PATTERNS.test(subject) || (NOTICE_PATTERNS.test(normalized) && labelled.amount === null)) {
    return {
      kind: "NOTICE",
      amount: null,
      direction: "UNKNOWN",
      description: (message.subject?.trim() || text.slice(0, 80)).slice(0, 200),
      counterparty: null,
      transactionDate,
      category: "OTHER_EXPENSE",
    };
  }

  let direction: ParsedBankMessage["direction"] = "UNKNOWN";
  if (INCOME_SUBJECT.test(subject)) direction = "INCOME";
  else if (EXPENSE_SUBJECT.test(subject)) direction = "EXPENSE";
  else if (INCOME_WORDS.test(normalized)) direction = "INCOME";
  else if (EXPENSE_WORDS.test(normalized)) direction = "EXPENSE";

  const amount = labelled.amount ?? stacked.amount ?? extractAmount(text);
  // What the movement was. A receipt that names the shop describes itself better
  // than its own subject line does.
  const named =
    (labelled.name && labelled.name.length >= 2 ? labelled.name : null) ??
    extractCounterparty(text, direction === "INCOME" ? "INCOME" : "EXPENSE");
  const description = named ?? message.subject?.trim() ?? text.slice(0, 80);
  // Who was on the other side. A receipt that states it outright — "Persona que
  // recibe" — is believed over a name guessed from the prose, and this is kept
  // apart from the description so naming the person never rewrites what happened.
  const counterparty = stacked.name ?? named;
  // The counterparty drives the category; the opening of the body is a fallback, never the
  // footer, because bank footers advertise every category ("pagos de servicios públicos…").
  const type = direction === "INCOME" ? "INCOME" : "EXPENSE";
  const fallback = type === "INCOME" ? "OTHER_INCOME" : "OTHER_EXPENSE";
  let category = guessCategory(type, description);
  if (category === fallback) category = guessCategory(type, text.slice(0, 160));

  return {
    kind: "TRANSACTION",
    amount,
    direction,
    description: description.slice(0, 200),
    counterparty: counterparty ? counterparty.slice(0, 120) : null,
    transactionDate,
    category,
  };
}
