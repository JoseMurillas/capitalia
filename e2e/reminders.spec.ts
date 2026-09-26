import { expect, test } from "@playwright/test";

import { login, uniqueName } from "./helpers";

/** Today in Colombia, the same clock the server reads to decide what is due. */
function todayInBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** Day arithmetic on a `yyyy-MM-dd` string, done in UTC so no time zone can shift it. */
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The whole loop with the mailer in dry-run: a loan whose installment falls due
 * tomorrow, the manual run, the screen, and no repeat on a second run.
 */
test.describe("Recordatorios de pago", () => {
  test("genera, envía, aparece en la pantalla y no repite", async ({ page }) => {
    await login(page);

    // Reminders are off by default; turn them on.
    await page.goto("/configuracion");
    const settingsCard = page.locator("[data-slot=card]", { hasText: "Recordatorios de pago" });
    const toggle = settingsCard.getByLabel("Enviar recordatorios automáticamente");
    if ((await toggle.getAttribute("aria-checked")) !== "true") {
      await toggle.click();
      await expect(page.getByText("Recordatorios activados")).toBeVisible();
    }

    // Its own box, so the loan below never depends on what other specs left in
    // the shared ones.
    const boxName = uniqueName("Caja recordatorios");
    await page.goto("/prestamos/cajas");
    await page.getByRole("button", { name: "Nueva caja" }).click();
    const boxDialog = page.getByRole("dialog", { name: "Nueva caja" });
    await boxDialog.getByLabel("Nombre").fill(boxName);
    await boxDialog.getByLabel("Capital inicial").fill("1000000");
    await boxDialog.getByRole("button", { name: "Crear caja" }).click();
    await expect(boxDialog).toBeHidden();

    // A borrower with an email.
    const personName = uniqueName("Deudor");
    const email = `deudor.${Date.now().toString(36)}@example.com`;
    await page.goto("/personas");
    await page.getByRole("button", { name: "Nueva persona" }).click();
    const personDialog = page.getByRole("dialog", { name: "Nueva persona" });
    await personDialog.getByLabel("Nombre completo").fill(personName);
    await personDialog.getByLabel("Correo").fill(email);
    await personDialog.getByRole("button", { name: "Crear persona" }).click();
    await expect(personDialog).toBeHidden();

    // A weekly installment falls due seven days after the start date, so starting
    // six days ago lands it exactly tomorrow — the day the first reminder goes
    // out. Weeks are exact: a month back from the 31st would not be.
    const startDate = addDays(todayInBogota(), -6);

    await page.goto("/prestamos/nuevo");
    await page.getByLabel("Persona").click();
    await page.getByRole("option", { name: personName }).click();
    await page.getByLabel("Caja").click();
    await page.getByRole("option", { name: new RegExp(boxName) }).click();
    await page.getByLabel("Monto prestado").fill("500000");
    await page.getByLabel("Interés mensual (%)").fill("10");
    await page.getByLabel("Número de cuotas").fill("1");
    await page.getByLabel("Frecuencia").click();
    await page.getByRole("option", { name: "Semanal" }).click();
    await page.getByLabel("Fecha de inicio").fill(startDate);
    await page.getByRole("button", { name: "Crear préstamo" }).click();
    await expect(page).toHaveURL(/\/prestamos\/(?!nuevo$)[^/]+$/);

    // Fire today's run by hand. Other borrowers may also be due today, so what
    // matters is that something went out and that this one is in it.
    await page.goto("/prestamos/recordatorios");
    await page.getByRole("button", { name: "Enviar ahora" }).click();
    await expect(page.getByText(/Enviados: [1-9]/)).toBeVisible();

    // Today's list shows it as sent, to that address.
    const row = page.getByRole("listitem").filter({ hasText: personName });
    await expect(row).toContainText("Enviado");
    await expect(row).toContainText(email);

    // A second run neither duplicates nor resends it: nothing new to generate
    // and nothing left pending.
    await page.getByRole("button", { name: "Enviar ahora" }).click();
    await expect(page.getByText(/Enviados: 0/)).toBeVisible();
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Enviado");
  });
});
