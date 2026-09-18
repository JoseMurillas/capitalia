import { expect, test } from "@playwright/test";

import { login, screenshotPath, uniqueName } from "./helpers";

test.describe("Capitalia end to end", () => {
  test("redirects anonymous visitors to login and rejects bad credentials", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard$/);

    await page.getByLabel("Correo").fill("admin@capitalia.local");
    await page.getByLabel("Contraseña").fill("definitely-wrong");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
  });

  test("full lending cycle: person → loan → payment → finance → reports → logout", async ({ page }) => {
    await login(page);

    // Dashboard renders its cards and charts.
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Capital prestado")).toBeVisible();
    await expect(page.getByText("Ingresos vs gastos")).toBeVisible();
    // Direct labels render once the bar animation finishes.
    await expect(page.locator(".recharts-label-list text").first()).toBeVisible();
    await page.screenshot({ path: screenshotPath("dashboard"), fullPage: true });

    // Create a person from the dialog.
    const personName = uniqueName("Prueba E2E");
    await page.goto("/personas");
    await page.getByRole("button", { name: "Nueva persona" }).click();
    const personDialog = page.getByRole("dialog", { name: "Nueva persona" });
    await personDialog.getByLabel("Nombre completo").fill(personName);
    await personDialog.getByLabel("Teléfono").fill("3000000000");
    await personDialog.getByRole("button", { name: "Crear persona" }).click();
    await expect(personDialog).toBeHidden();
    await expect(page.getByRole("link", { name: personName })).toBeVisible();

    // Create a loan: 1.000.000 at 12 % in 3 monthly installments.
    await page.goto("/prestamos/nuevo");
    await page.getByLabel("Persona").click();
    await page.getByRole("option", { name: new RegExp(personName) }).click();
    await page.getByLabel("Monto prestado").fill("1000000");
    await page.getByLabel("Interés mensual (%)").fill("12");
    await page.getByLabel("Número de cuotas").fill("3");
    await page.getByLabel("Fecha de inicio").fill("2026-09-01");

    // The schedule preview is computed on the server.
    const preview = page.getByText("Cronograma de cuotas").locator("..").locator("..");
    await expect(preview.getByText("$360.000").first()).toBeVisible();
    await expect(preview.getByText("$1.360.000").first()).toBeVisible();
    await page.screenshot({ path: screenshotPath("loan-form"), fullPage: true });

    await page.getByRole("button", { name: "Crear préstamo" }).click();
    await expect(page).toHaveURL(/\/prestamos\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: `Préstamo a ${personName}` })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$453.333" }).first()).toBeVisible();
    const loanUrl = page.url();

    // Register a payment that covers interest and part of the principal.
    await page.getByRole("button", { name: "Registrar pago" }).click();
    const paymentDialog = page.getByRole("dialog", { name: "Registrar pago" });
    await paymentDialog.getByLabel("Monto").fill("200000");
    await paymentDialog.getByRole("button", { name: "Registrar pago" }).click();
    await expect(paymentDialog).toBeHidden();
    await expect(page.getByText("$120.000 a intereses y $80.000 a capital")).toBeVisible();
    await expect(page.getByText("Parcial").first()).toBeVisible();
    await page.screenshot({ path: screenshotPath("loan-detail"), fullPage: true });

    // A payment above the balance is rejected by the server.
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await paymentDialog.getByLabel("Monto").fill("99999999");
    await paymentDialog.getByRole("button", { name: "Registrar pago" }).click();
    await expect(paymentDialog.getByText(/supera el saldo pendiente/)).toBeVisible();
    await paymentDialog.getByRole("button", { name: "Cancelar" }).click();

    // The payment shows up in the global payments list.
    await page.goto("/pagos");
    await expect(page.getByRole("link", { name: personName }).first()).toBeVisible();

    // Personal finance: register an expense.
    await page.goto("/finanzas");
    await page.getByRole("button", { name: "Gasto" }).click();
    const txDialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await txDialog.getByLabel("Monto").fill("45000");
    await txDialog.getByLabel("Categoría").click();
    await page.getByRole("option", { name: "Transporte" }).click();
    const description = uniqueName("Taxi");
    await txDialog.getByLabel("Descripción").fill(description);
    await txDialog.getByRole("button", { name: "Registrar" }).click();
    await expect(txDialog).toBeHidden();
    await expect(page.getByRole("table").getByText(description)).toBeVisible();
    await page.screenshot({ path: screenshotPath("finance"), fullPage: true });

    // Reports load with the default month.
    await page.goto("/reportes");
    await expect(page.getByRole("heading", { name: "Resultado del periodo" })).toBeVisible();
    await expect(page.getByText("Utilidad", { exact: true })).toBeVisible();
    await page.screenshot({ path: screenshotPath("reports"), fullPage: true });

    // Loan detail is still reachable and consistent.
    await page.goto(loanUrl);
    await expect(page.getByText("Pagos registrados")).toBeVisible();

    // Logout returns to login and protects the dashboard again.
    await page.getByRole("button", { name: /Administrador|admin@/ }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
