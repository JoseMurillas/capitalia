import type { TransactionCategoryValue } from "@/lib/validations/transaction";

type Rule = { pattern: RegExp; category: TransactionCategoryValue };

const EXPENSE_RULES: Rule[] = [
  { pattern: /arriendo|arrendamiento|hipoteca|administracion|conjunto/, category: "HOUSING" },
  {
    pattern: /servicio|epm|enel|codensa|emcali|acueducto|gas natural|vanti|claro|movistar|tigo|etb|internet|energia|agua\b/,
    category: "SERVICES",
  },
  {
    pattern: /uber|didi|cabify|taxi|gasolina|combustible|terpel|primax|peaje|parqueadero|transmilenio|metro|bus\b|pasaje|transporte/,
    category: "TRANSPORT",
  },
  {
    // Word boundaries matter: "exitoso" is not the Éxito supermarket.
    pattern: /\bexito\b|carulla|jumbo|olimpica|\bd1\b|\bara\b|\bjusto\b|makro|alkosto|mercado|supermercado|restaurante|rappi|domicilio|comida|panaderia|alimentacion|almuerzo/,
    category: "FOOD",
  },
  { pattern: /netflix|spotify|disney|hbo|cine|teatro|bar\b|licor|entretenimiento|juego|steam|playstation|xbox/, category: "ENTERTAINMENT" },
];

const INCOME_RULES: Rule[] = [
  { pattern: /nomina|salario|sueldo|honorario/, category: "SALARY" },
  { pattern: /interes/, category: "LOAN_INTEREST" },
];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Keyword-based category suggestion for imported or received movements. */
export function guessCategory(type: "INCOME" | "EXPENSE", description: string): TransactionCategoryValue {
  const text = normalizeText(description);
  const rules = type === "INCOME" ? INCOME_RULES : EXPENSE_RULES;
  const match = rules.find((rule) => rule.pattern.test(text));
  if (match) return match.category;
  return type === "INCOME" ? "OTHER_INCOME" : "OTHER_EXPENSE";
}
