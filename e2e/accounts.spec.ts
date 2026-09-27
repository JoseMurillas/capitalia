import { expect, type Page, test } from "@playwright/test";

import { createAccount, login, uniqueName } from "./helpers";

/**
 * The card whose title is exactly this. Filtering by `hasText` would also catch
 * the card that says «El cupo no es dinero disponible», because that match is a
 * case-insensitive substring; the title has to be matched whole.
 */
function statCard(page: Page, title: string) {
  return page.locator("[data-slot=card]").filter({ has: page.getByText(title, { exact: true }) });
}

/** The money span of a card, which is the only text in it shaped like an amount. */
function amountIn(page: Page, title: string) {
  return statCard(page, title).getByText(/^-?\$[\d.]+$/);
}

/**
 * How many movements the «saldos incompletos» notice says are still without an
 * account, read from whichever screen is open. Zero when there is no notice.
 */
async function unassignedCount(page: Page): Promise<number> {
  const notice = page.getByText(/(Falta 1 movimiento|Faltan \d+ movimientos) por asignar/);
  if ((await notice.count()) === 0) return 0;
  return Number(/(\d+)/.exec(await notice.first().innerText())?.[1] ?? 0);
}

test.describe("Cuentas", () => {
  test("crear con saldo, gastar, transferir, depositar en una caja y asignar un movimiento", async ({ page }) => {
    await login(page);

    // Everything this test reads is created by it: the lists paginate and the
    // accounts screen adds up whatever else the database already holds.
    const debit = uniqueName("Prueba E2E débito");
    const cash = uniqueName("Prueba E2E efectivo");
    const boxName = uniqueName("Prueba E2E caja");
    const expense = uniqueName("Mercado");

    // 1. Two accounts, each opening with the money it really holds today.
    await createAccount(page, { name: debit, kind: "Tarjeta débito", openingBalance: "2000000" });
    await createAccount(page, { name: cash, kind: "Efectivo", openingBalance: "300000" });

    const debitCard = page.locator("[data-slot=card]", { hasText: debit });
    const cashCard = page.locator("[data-slot=card]", { hasText: cash });
    await expect(debitCard.getByText("$2.000.000")).toBeVisible();
    await expect(cashCard.getByText("$300.000")).toBeVisible();

    // 2. The Resumen stops estimating: it shows the same total as this screen.
    const total = await amountIn(page, "Total en tus cuentas").innerText();
    const pendingBefore = await unassignedCount(page);

    await page.goto("/finanzas");
    await expect(amountIn(page, "Dinero disponible")).toHaveText(total);
    await expect(statCard(page, "Dinero disponible")).toContainText("Suma de los saldos de tus cuentas activas");
    await expect(statCard(page, "Disponible estimado")).toContainText(
      "Suma de tus cuentas activas menos los compromisos del mes",
    );
    // While movements remain unassigned, the Resumen says so too (spec §4.2).
    expect(await unassignedCount(page)).toBe(pendingBefore);

    // 3. An expense leaves the account it was paid from.
    await page.goto("/finanzas/movimientos");
    await page.getByRole("button", { name: "Gasto" }).click();
    const form = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await form.getByLabel("Monto").fill("500000");
    await form.getByLabel("Categoría").click();
    await page.getByRole("option", { name: "Alimentación", exact: true }).click();
    await form.getByLabel("Cuenta", { exact: true }).click();
    await page.getByRole("option", { name: debit }).click();
    await form.getByLabel("Descripción").fill(expense);
    await form.getByRole("button", { name: "Registrar" }).click();
    await expect(form).toBeHidden();
    await expect(page.getByRole("row", { name: new RegExp(expense) })).toContainText(debit);

    await page.goto("/finanzas/cuentas");
    await expect(debitCard.getByText("$1.500.000")).toBeVisible();

    // 4. A transfer writes both legs: one account loses what the other gains.
    await debitCard.getByRole("button", { name: `Acciones para ${debit}` }).click();
    await page.getByRole("menuitem", { name: "Transferir" }).click();
    const transfer = page.getByRole("dialog", { name: /^Transferir/ });
    await transfer.getByLabel("Monto").fill("200000");
    await transfer.getByLabel("Cuenta destino").click();
    await page.getByRole("option", { name: cash }).click();
    await transfer.getByRole("button", { name: "Transferir" }).click();
    await expect(transfer).toBeHidden();
    await expect(debitCard.getByText("$1.300.000")).toBeVisible();
    await expect(cashCard.getByText("$500.000")).toBeVisible();

    await debitCard.getByRole("link", { name: debit }).click();
    await expect(page.getByRole("heading", { name: debit })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(`Transferencia a ${cash}`) })).toContainText("-$200.000");
    await expect(page.getByRole("row", { name: /Saldo inicial/ })).toContainText("$2.000.000");

    await page.goto("/finanzas/cuentas");
    await cashCard.getByRole("link", { name: cash }).click();
    await expect(page.getByRole("row", { name: new RegExp(`Transferencia desde ${debit}`) })).toContainText(
      "+$200.000",
    );

    // 5. Capital moved into a box leaves the account, and both books say so.
    await page.goto("/prestamos/cajas");
    await page.getByRole("button", { name: "Nueva caja" }).click();
    const boxDialog = page.getByRole("dialog", { name: "Nueva caja" });
    await boxDialog.getByLabel("Nombre").fill(boxName);
    await boxDialog.getByLabel("Capital inicial").fill("0");
    await boxDialog.getByRole("button", { name: "Crear caja" }).click();
    await expect(boxDialog).toBeHidden();

    const box = page.locator("[data-slot=card]", { hasText: boxName });
    await box.getByRole("button", { name: `Acciones para ${boxName}` }).click();
    await page.getByRole("menuitem", { name: "Depositar" }).click();
    const deposit = page.getByRole("dialog", { name: /Depositar capital/ });
    await deposit.getByLabel("Monto").fill("400000");
    // The «Cuenta» field only exists for money that comes out of your own pocket.
    await deposit.getByLabel("Origen del dinero").click();
    await page.getByRole("option", { name: "Finanzas personales" }).click();
    await deposit.getByLabel("Cuenta", { exact: true }).click();
    await page.getByRole("option", { name: debit }).click();
    await deposit.getByRole("button", { name: "Depositar" }).click();
    await expect(deposit).toBeHidden();
    await expect(box.getByText("$400.000").first()).toBeVisible();

    await page.goto("/finanzas/cuentas");
    await expect(debitCard.getByText("$900.000")).toBeVisible();
    await debitCard.getByRole("link", { name: debit }).click();
    const mirrored = page.getByRole("row", { name: new RegExp(`Depósito en ${boxName}`) });
    await expect(mirrored).toContainText("-$400.000");
    // The row leads back to the box the money went into.
    await mirrored.getByRole("link").click();
    await expect(page.getByRole("heading", { name: boxName })).toBeVisible();

    // 6. An old movement gets its account from the list itself. Nothing in the
    // app can create one anymore — the field is required wherever a movement is
    // born — so this leg works on what the database had before accounts existed.
    await page.goto("/finanzas/movimientos?cuenta=sin-cuenta");
    const assign = page.getByRole("table").getByRole("combobox", { name: /^Asignar cuenta a / });
    if (pendingBefore > 0) {
      await expect(assign.first()).toBeVisible();
      await assign.first().click();
      await page.getByRole("option", { name: cash }).click();
      await expect(page.getByText("Movimiento asignado")).toBeVisible();

      // One less to assign, counted where the warning is shown.
      await page.goto("/finanzas/cuentas");
      expect(await unassignedCount(page)).toBe(pendingBefore - 1);
    } else {
      await expect(page.getByText("Todos los movimientos tienen cuenta")).toBeVisible();
      await page.goto("/finanzas/cuentas");
      expect(await unassignedCount(page)).toBe(0);
    }

    // 7. An account with history cannot be deleted, only deactivated — which is
    // also how this test gives the accounts screen back to its owner.
    for (const name of [debit, cash]) {
      const card = page.locator("[data-slot=card]", { hasText: name });
      await card.getByRole("button", { name: `Acciones para ${name}` }).click();
      await page.getByRole("menuitem", { name: "Eliminar" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText(/ya tiene movimientos/)).toBeVisible();
      await expect(card).toBeVisible();

      await card.getByRole("button", { name: `Acciones para ${name}` }).click();
      await page.getByRole("menuitem", { name: "Desactivar" }).click();
      await expect(card.getByText("Inactiva")).toBeVisible();
    }
  });
});
