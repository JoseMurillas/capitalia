import { expect, test } from "@playwright/test";

import { login, uniqueName } from "./helpers";

test.describe("Cajas de capital", () => {
  test("crear caja, depositar, prestar, cobrar, retirar y reasignar", async ({ page }) => {
    await login(page);

    const boxName = uniqueName("Caja");
    const otherName = uniqueName("Caja B");

    // Two boxes: the money will start in the first and end up partly moved to the second.
    await page.goto("/prestamos/cajas");
    for (const [name, opening] of [
      [boxName, "2000000"],
      [otherName, "1000000"],
    ] as const) {
      await page.getByRole("button", { name: "Nueva caja" }).click();
      const dialog = page.getByRole("dialog", { name: "Nueva caja" });
      await dialog.getByLabel("Nombre").fill(name);
      await dialog.getByLabel("Capital inicial").fill(opening);
      await dialog.getByRole("button", { name: "Crear caja" }).click();
      await expect(dialog).toBeHidden();
    }

    const box = page.locator("[data-slot=card]", { hasText: boxName });
    const otherBox = page.locator("[data-slot=card]", { hasText: otherName });
    await expect(box.getByText("$2.000.000").first()).toBeVisible();

    // Deposit from personal finances.
    await box.getByRole("button", { name: `Acciones para ${boxName}` }).click();
    await page.getByRole("menuitem", { name: "Depositar" }).click();
    const deposit = page.getByRole("dialog", { name: /Depositar capital/ });
    await deposit.getByLabel("Monto").fill("500000");
    await deposit.getByRole("button", { name: "Depositar" }).click();
    await expect(deposit).toBeHidden();
    await expect(box.getByText("$2.500.000").first()).toBeVisible();

    // A loan takes money out of the box.
    const personName = uniqueName("Prestatario");
    await page.goto("/personas");
    await page.getByRole("button", { name: "Nueva persona" }).click();
    const personDialog = page.getByRole("dialog", { name: "Nueva persona" });
    await personDialog.getByLabel("Nombre completo").fill(personName);
    await personDialog.getByRole("button", { name: "Crear persona" }).click();
    await expect(personDialog).toBeHidden();

    await page.goto("/prestamos/nuevo");
    await page.getByLabel("Persona").click();
    await page.getByRole("option", { name: personName }).click();
    await page.getByLabel("Caja").click();
    await page.getByRole("option", { name: new RegExp(boxName) }).click();
    await page.getByLabel("Monto prestado").fill("1000000");
    await page.getByLabel("Interés mensual (%)").fill("10");
    await page.getByLabel("Número de cuotas").fill("1");
    await page.getByRole("button", { name: "Crear préstamo" }).click();
    // Excludes /prestamos/nuevo itself (which also matches a bare [^/]+ tail), so this
    // actually waits for the post-submit redirect to the new loan's detail page.
    await expect(page).toHaveURL(/\/prestamos\/(?!nuevo$)[^/]+$/);
    const loanUrl = page.url();

    await page.goto("/prestamos/cajas");
    await expect(page.locator("[data-slot=card]", { hasText: boxName }).getByText("$1.500.000").first()).toBeVisible();

    // The payment comes back in full: capital and interest.
    await page.goto("/pagos");
    await page.getByRole("button", { name: "Registrar pago" }).first().click();
    const payment = page.getByRole("dialog", { name: /Registrar pago/ });
    await payment.getByLabel("Préstamo").click();
    await page.getByRole("option", { name: new RegExp(personName) }).click();
    await payment.getByLabel("Monto").fill("1100000");
    await payment.getByRole("button", { name: "Registrar pago" }).click();
    await expect(payment).toBeHidden();

    await page.goto("/prestamos/cajas");
    await expect(box.getByText("$2.600.000").first()).toBeVisible();

    // A withdrawal to personal finances takes money out of the first box.
    // 2,600,000 - 200,000 = 2,400,000
    await box.getByRole("button", { name: `Acciones para ${boxName}` }).click();
    await page.getByRole("menuitem", { name: "Retirar" }).click();
    const withdrawal = page.getByRole("dialog", { name: /Retirar capital/ });
    await withdrawal.getByLabel("Monto").fill("200000");
    await withdrawal.getByLabel("Destino del dinero").click();
    await page.getByRole("option", { name: "Finanzas personales" }).click();
    await withdrawal.getByRole("button", { name: "Retirar" }).click();
    await expect(withdrawal).toBeHidden();
    await expect(box.getByText("$2.400.000").first()).toBeVisible();

    // Reassign the loan to the second box. It was paid in full (capital + interest),
    // so the payment received (1,100,000) exceeds the principal (1,000,000): the net
    // is negative (1,000,000 - 1,100,000 = -100,000), so the ORIGIN box pays the
    // difference to the destination, not the other way around.
    await page.goto(loanUrl);
    await page.getByRole("button", { name: "Cambiar caja" }).click();
    const reassign = page.getByRole("dialog", { name: "Cambiar caja" });
    await reassign.getByLabel("Nueva caja").click();
    await page.getByRole("option", { name: new RegExp(otherName) }).click();
    await reassign.getByRole("button", { name: "Mover préstamo" }).click();
    await expect(reassign).toBeHidden();

    await page.goto("/prestamos/cajas");
    // Origin recovers the net: 2,400,000 - 100,000 = 2,300,000
    await expect(box.getByText("$2.300.000").first()).toBeVisible();
    // Destination pays it: 1,000,000 + 100,000 = 1,100,000
    await expect(otherBox.getByText("$1.100.000").first()).toBeVisible();
  });
});
