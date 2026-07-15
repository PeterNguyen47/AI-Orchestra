import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function demoCredentials() {
  const content = readFileSync(".demo-credentials.txt", "utf8");
  const username = content.match(/^Username: (.+)$/m)?.[1]?.trim();
  const password = content.match(/^Password: (.+)$/m)?.[1]?.trim();
  if (!username || !password) throw new Error("Run npm run demo:setup before browser tests.");
  return { username, password };
}

test("login, protected dashboard, navigation, accessibility, and logout", async ({ page }) => {
  const credentials = demoCredentials();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  await page.screenshot({ path: "test-results/ao004-login.png", fullPage: true });

  await page.getByLabel("Demonstration username").fill("unknown-user");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toHaveText("Invalid username or password.");

  await page.getByLabel("Demonstration username").fill(credentials.username);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Blueprint status, without the theater." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Enterprise RAG blueprint" }).click();
  await expect(page).toHaveURL(/#enterprise-rag$/);
  const summary = page.locator("#enterprise-rag summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#enterprise-rag")).toHaveAttribute("open", "");
  await expect(page.getByText("9", { exact: true })).toBeVisible();
  await expect(page.getByText("Valid", { exact: true })).toBeVisible();

  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  await summary.evaluate((element) => (element as HTMLElement).blur());
  await page.setViewportSize({ width: 1280, height: 900 });
  await summary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/ao004-dashboard.png" });

  await page.getByRole("button", { name: "Log out" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("login and dashboard remain usable at a mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
