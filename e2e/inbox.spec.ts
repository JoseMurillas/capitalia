import { expect, test } from "@playwright/test";

import { login } from "./helpers";

const TAG = Date.now().toString(36);

test.describe("bank inbox", () => {
  test("generates a token in settings, receives bank emails and confirms one as an expense", async ({ page, request }) => {
    await login(page);

    // The token is created from the app itself, no environment variable needed.
    await page.goto("/configuracion");
    const card = page.locator("[data-slot=card]", { hasText: "Bandeja del banco" });
    await card.getByRole("button", { name: /Generar clave/ }).click();
    const rotateDialog = page.getByRole("alertdialog");
    if (await rotateDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      await rotateDialog.getByRole("button", { name: "Generar" }).click();
    }
    const script = card.getByLabel("Script de Google Apps Script");
    await expect(script).toBeVisible();
    const scriptText = await script.inputValue();
    const token = /const CAPITALIA_TOKEN = "([a-f0-9]+)"/.exec(scriptText)?.[1];
    expect(token).toBeTruthy();
    expect(scriptText).toContain("/api/inbox");

    const noToken = await request.post("/api/inbox", { data: { source: "email", messages: [] } });
    expect(noToken.status()).toBe(401);
    const wrongToken = await request.post("/api/inbox", {
      headers: { Authorization: "Bearer not-the-token" },
      data: { source: "email", messages: [] },
    });
    expect(wrongToken.status()).toBe(401);

    const payload = {
      source: "email",
      messages: [
        {
          externalId: `msg-${TAG}-1`,
          receivedAt: "2026-09-20T14:35:00-05:00",
          sender: "alertasynotificaciones@bancolombia.com.co",
          subject: "Alertas y Notificaciones",
          text: `Bancolombia le informa Compra por $45.000,00 en EXITO CALLE 80 ${TAG} el 20/09/2026 a las 14:33 con tarjeta *1234.`,
        },
        {
          externalId: `msg-${TAG}-2`,
          receivedAt: "2026-09-19T09:00:00-05:00",
          sender: "notificaciones@nequi.com.co",
          subject: "Recibiste plata",
          text: `Recibiste una transferencia de MARIA GOMEZ ${TAG} por $700.000 el 19/09/2026.`,
        },
      ],
    };
    const auth = { Authorization: `Bearer ${token}` };

    const first = await request.post("/api/inbox", { headers: auth, data: payload });
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ received: 2, skipped: 0 });

    // Re-delivering the same emails is a no-op.
    const again = await request.post("/api/inbox", { headers: auth, data: payload });
    expect(await again.json()).toEqual({ received: 0, skipped: 2 });

    await page.goto("/finanzas");
    await page.getByRole("link", { name: /Bandeja del banco/ }).click();
    await expect(page).toHaveURL(/\/finanzas\/bandeja$/);

    const purchase = page.locator("li", { hasText: `EXITO CALLE 80 ${TAG}` });
    await expect(purchase).toBeVisible();
    await expect(purchase.getByText("-$45.000")).toBeVisible();
    await expect(purchase.getByText("Gasto", { exact: true })).toBeVisible();
    await expect(purchase.getByText("Alimentación")).toBeVisible();

    const income = page.locator("li", { hasText: `MARIA GOMEZ ${TAG}` });
    await expect(income.getByText("+$700.000")).toBeVisible();
    await expect(income.getByText("Ingreso", { exact: true })).toBeVisible();

    // Confirm the purchase with the suggested values.
    await purchase.getByRole("button", { name: "Confirmar" }).click();
    const confirm = page.getByRole("dialog", { name: "Confirmar movimiento" });
    await expect(confirm.getByLabel("Monto")).toHaveValue("45000");
    await expect(confirm.getByLabel("Fecha")).toHaveValue("2026-09-20");
    await confirm.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(confirm).toBeHidden();
    await expect(purchase).toBeHidden();

    // The borrower's transfer is a loan payment, not personal income: discard it.
    await income.getByRole("button", { name: "Descartar" }).click();
    await expect(income).toBeHidden();

    await page.goto("/finanzas?from=2026-09-20&to=2026-09-20");
    // The merchant is extracted in upper case, so the lower-case tag is not part of the description.
    await expect(page.getByRole("table").getByText("EXITO CALLE 80").first()).toBeVisible();
  });
});
