import { expect, test } from "@playwright/test";

import { login, uniqueName } from "./helpers";

test.describe("Compromisos financieros", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("gasto recurrente: crear, marcar pagado, gasto registrado y fecha avanzada", async ({ page }) => {
    const name = uniqueName("Internet");

    await page.goto("/finanzas/recurrentes");
    await page.getByRole("button", { name: "Nuevo gasto recurrente" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo gasto recurrente" });
    await dialog.getByLabel("Nombre", { exact: true }).fill(name);
    await dialog.getByLabel("Categoría").click();
    await page.getByRole("option", { name: "Servicios", exact: true }).click();
    await dialog.getByLabel("Valor", { exact: true }).fill("120000");
    await dialog.getByLabel("Próximo pago").fill("2026-09-24");
    await dialog.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("24 sep 2026");

    await row.getByRole("button", { name: `Acciones para ${name}` }).click();
    await page.getByRole("menuitem", { name: "Marcar pagado" }).click();
    const paid = page.getByRole("dialog", { name: /Marcar pagado/ });
    await expect(paid.getByLabel("Monto")).toHaveValue("120000");
    await paid.getByRole("button", { name: "Registrar pago" }).click();
    await expect(paid).toBeHidden();

    // The next due date moved one month ahead and the expense exists in Movimientos.
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("24 oct 2026");
    await page.goto("/finanzas/movimientos");
    await expect(page.getByRole("table").getByText(name)).toBeVisible();

    // The overview renders (whether the item is inside the 30-day horizon depends on today's date).
    await page.goto("/finanzas");
    await expect(page.getByRole("heading", { name: "Finanzas personales" })).toBeVisible();
    await expect(page.getByText("Próximos compromisos")).toBeVisible();
  });

  test("tarjeta de crédito: crear, pagar, saldo reducido y gasto registrado", async ({ page }) => {
    const name = uniqueName("Visa Prueba");

    await page.goto("/finanzas/tarjetas");
    await page.getByRole("button", { name: "Nueva tarjeta" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva tarjeta de crédito" });
    await dialog.getByLabel("Nombre o banco").fill(name);
    await dialog.getByLabel("Cupo total").fill("5000000");
    await dialog.getByLabel("Saldo pendiente").fill("2000000");
    await dialog.getByLabel("Pago mínimo").fill("200000");
    await dialog.getByLabel("Pago planeado").fill("650000");
    await dialog.getByRole("button", { name: "Registrar tarjeta" }).click();
    await expect(dialog).toBeHidden();

    const card = page.locator("[data-slot=card]", { hasText: name });
    await expect(card.getByText("40%")).toBeVisible();

    await card.getByRole("button", { name: `Acciones para ${name}` }).click();
    await page.getByRole("menuitem", { name: "Registrar pago" }).click();
    const pay = page.getByRole("dialog", { name: /Registrar pago/ });
    await expect(pay.getByLabel("Monto")).toHaveValue("650000");
    await pay.getByRole("button", { name: "Registrar pago" }).click();
    await expect(pay).toBeHidden();

    // 1.350.000 / 5.000.000 = 27 %
    await expect(card.getByText("27%")).toBeVisible();

    await page.goto("/finanzas/movimientos");
    await expect(page.getByRole("table").getByText(`Pago tarjeta ${name}`)).toBeVisible();
  });
});
