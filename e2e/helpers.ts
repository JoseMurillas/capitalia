import { expect, type Locator, type Page } from "@playwright/test";

export const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@capitalia.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123*",
};

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(ADMIN.email);
  await page.getByLabel("Contraseña").fill(ADMIN.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

export function screenshotPath(name: string): string {
  return `e2e/screenshots/${name}.png`;
}

/**
 * The account every spec charges its own movements to.
 *
 * Money now always leaves an account, so a spec that registers a movement needs
 * one to pick. It must not be a real one — the suite would spend from it — and
 * a fresh one per run would pile up accounts nobody can remove, because an
 * account with movements can only be deactivated. So the suite keeps exactly
 * one of its own, named so it is obvious in the list, and reuses it.
 */
export const E2E_ACCOUNT = "Cuenta de pruebas E2E";

type NewAccount = { name: string; kind?: string; openingBalance?: string };

/** Creates an account from the accounts screen and leaves that screen open. */
export async function createAccount(page: Page, account: NewAccount) {
  await page.goto("/finanzas/cuentas");
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva cuenta" });
  await dialog.getByLabel("Nombre", { exact: true }).fill(account.name);
  if (account.kind) {
    await dialog.getByLabel("Tipo").click();
    await page.getByRole("option", { name: account.kind, exact: true }).click();
  }
  await dialog.getByLabel("Saldo inicial").fill(account.openingBalance ?? "0");
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog).toBeHidden();
}

/** The suite's own account, created the first time a database needs it. */
export async function ensureE2EAccount(page: Page): Promise<string> {
  await page.goto("/finanzas/cuentas");
  if ((await page.locator("[data-slot=card]", { hasText: E2E_ACCOUNT }).count()) === 0) {
    await createAccount(page, { name: E2E_ACCOUNT, kind: "Efectivo" });
  }
  return E2E_ACCOUNT;
}

/**
 * Picks the account in a «Cuenta» selector. Never left to the form's own
 * default: it only fills itself in when the database happens to hold a single
 * account, and a spec that relied on that would break the day a second one
 * exists.
 */
export async function chooseAccount(page: Page, dialog: Locator, name: string) {
  await dialog.getByLabel("Cuenta", { exact: true }).click();
  await page.getByRole("option", { name }).click();
}
