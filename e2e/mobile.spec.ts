import { expect, test } from "@playwright/test";

import { login, screenshotPath } from "./helpers";

test("mobile navigation opens the sidebar as a sheet", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator(".recharts-label-list text").first()).toBeVisible();
  await page.screenshot({ path: screenshotPath("mobile-dashboard"), fullPage: true });

  await page.getByRole("button", { name: /Toggle Sidebar/i }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: "Préstamos", exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath("mobile-menu") });

  await sheet.getByRole("link", { name: "Préstamos", exact: true }).click();
  await expect(page).toHaveURL(/\/prestamos$/);
  await expect(page.getByRole("heading", { name: "Préstamos" })).toBeVisible();
  await page.screenshot({ path: screenshotPath("mobile-loans"), fullPage: true });
});
