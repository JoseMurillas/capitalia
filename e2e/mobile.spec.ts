import { expect, test } from "@playwright/test";

import { login, screenshotPath } from "./helpers";

test("phone layout: bottom navigation, card lists and bottom-sheet dialogs", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator(".recharts-label-list text").first()).toBeVisible();
  await page.screenshot({ path: screenshotPath("mobile-dashboard"), fullPage: true });

  // Bottom navigation is the primary way to move around on a phone.
  const bottomNav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(bottomNav).toBeVisible();
  await bottomNav.getByRole("link", { name: "Préstamos" }).click();
  await expect(page).toHaveURL(/\/prestamos$/);
  await expect(page.getByRole("heading", { name: "Préstamos" })).toBeVisible();

  // Rows render as cards, not a squeezed table.
  await expect(page.getByRole("table")).toBeHidden();
  const firstCard = page.getByRole("link", { name: /Pedro Sánchez|María Gómez|Juan Pérez|Ana Martínez/ }).first();
  await expect(firstCard).toBeVisible();
  await page.screenshot({ path: screenshotPath("mobile-loans"), fullPage: true });

  await firstCard.click();
  await expect(page).toHaveURL(/\/prestamos\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: /^Préstamo a / })).toBeVisible();
  await expect(page.getByText(/^Cuota #1$/)).toBeVisible();
  await page.screenshot({ path: screenshotPath("mobile-loan-detail"), fullPage: true });

  // Dialogs open as a bottom sheet with comfortable controls.
  const payButton = page.getByRole("button", { name: "Registrar pago" });
  if (await payButton.isEnabled()) {
    await payButton.click();
    const dialog = page.getByRole("dialog", { name: "Registrar pago" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && Math.round(box.y + box.height) >= viewport.height - 1).toBe(true);
    await page.screenshot({ path: screenshotPath("mobile-payment-dialog") });
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  }

  // "Más" opens the full menu for the secondary sections.
  await bottomNav.getByRole("button", { name: "Abrir menú completo" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: "Finanzas", exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath("mobile-menu") });
  await sheet.getByRole("link", { name: "Finanzas", exact: true }).click();
  await expect(page).toHaveURL(/\/finanzas$/);
  await expect(page.getByRole("table")).toBeHidden();
  await page.screenshot({ path: screenshotPath("mobile-finance"), fullPage: true });
});
