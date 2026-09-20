import { expect, test } from "@playwright/test";

import { login } from "./helpers";

const TOKEN = process.env.INBOX_TOKEN ?? "";
const TAG = Date.now().toString(36);

test.describe("bank inbox", () => {
  test.skip(!TOKEN, "INBOX_TOKEN is not set in this environment");

  test("rejects deliveries without the token", async ({ request }) => {
    const response = await request.post("/api/inbox", {
      data: { source: "email", messages: [] },
    });
    expect(response.status()).toBe(401);
  });

  test("receives bank emails and turns a confirmed one into an expense", async ({ page, request }) => {
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

    const first = await request.post("/api/inbox", {
      headers: { Authorization: `Bearer ${TOKEN}` },
      data: payload,
    });
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ received: 2, skipped: 0 });

    // Re-delivering the same emails is a no-op.
    const again = await request.post("/api/inbox", {
      headers: { Authorization: `Bearer ${TOKEN}` },
      data: payload,
    });
    expect(await again.json()).toEqual({ received: 0, skipped: 2 });

    await login(page);
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
    const dialog = page.getByRole("dialog", { name: "Confirmar movimiento" });
    await expect(dialog.getByLabel("Monto")).toHaveValue("45000");
    await expect(dialog.getByLabel("Fecha")).toHaveValue("2026-09-20");
    await dialog.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(dialog).toBeHidden();
    await expect(purchase).toBeHidden();

    // The borrower's transfer is a loan payment, not personal income: discard it.
    await income.getByRole("button", { name: "Descartar" }).click();
    await expect(income).toBeHidden();

    await page.goto("/finanzas?from=2026-09-20&to=2026-09-20");
    // The merchant is extracted in upper case, so the lower-case tag is not part of the description.
    await expect(page.getByRole("table").getByText("EXITO CALLE 80").first()).toBeVisible();
  });
});
