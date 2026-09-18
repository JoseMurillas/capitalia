import { expect, type Page } from "@playwright/test";

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
