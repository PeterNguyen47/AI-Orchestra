import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function demoCredentials() {
  const content = readFileSync(".demo-credentials.txt", "utf8");
  const username = content.match(/^Username: (.+)$/m)?.[1]?.trim();
  const password = content.match(/^Password: (.+)$/m)?.[1]?.trim();
  if (!username || !password) throw new Error("Run npm run demo:setup before browser tests.");
  return { username, password };
}

async function signIn(page: Page): Promise<void> {
  const credentials = demoCredentials();
  await page.goto("/login");
  await page.getByLabel("Demonstration username").fill(credentials.username);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function expectCanonicalCounts(page: Page): Promise<void> {
  await expect(page.locator(".react-flow__node")).toHaveCount(9);
  await expect(page.locator(".react-flow__edge")).toHaveCount(8);
  await expect(page.getByTestId("workflow-status")).toContainText("9 nodes");
  await expect(page.getByTestId("workflow-status")).toContainText("8 edges");
}

test("orchestrator is protected when no session exists", async ({ page }) => {
  await page.goto("/orchestrator");
  await expect(page).toHaveURL(/\/login$/);
});

test("compose, inspect, connect, reject, delete, reset, reload, and check accessibility", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Orchestrator" }).click();
  await expect(page).toHaveURL(/\/orchestrator$/);
  await expectCanonicalCounts(page);
  await expect(page.getByText("executable", { exact: true })).toHaveCount(8);
  await expect(page.getByText("simulated", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Add roadmap component Retrieval" })).toBeVisible();
  await expect(page.getByText("Runtime · user query", { exact: true })).toBeVisible();
  await expect(page.getByText("Advisory · relational records", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "React Flow attribution" })).toBeVisible();

  const userNode = page.getByTestId("rf__node-user-input");
  const selectUserNode = page.getByRole("button", { name: "Select User Question" });
  await selectUserNode.press("Enter");
  await expect(page.getByTestId("node-inspector")).toContainText("User Question");
  await expect(page.getByTestId("node-inspector")).toContainText("0, 0");
  await userNode.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("node-inspector")).toContainText("5, 0");

  const addRetrieval = page.getByRole("button", { name: "Add roadmap component Retrieval" });
  await addRetrieval.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".react-flow__node")).toHaveCount(10);
  await expect(page.getByTestId("node-inspector")).toContainText("Roadmap Retrieval");
  const addedNode = page.locator('.react-flow__node[data-id^="node-"]');
  await expect(addedNode).toHaveCount(1);
  const addedNodeId = await addedNode.getAttribute("data-id");
  if (!addedNodeId) throw new Error("The added node did not receive a stable ID.");

  await page.getByLabel("Source component").selectOption("document-source");
  await page.getByLabel("Source output port").selectOption("documents-out");
  await page.getByLabel("Target component").selectOption(addedNodeId);
  await page.getByLabel("Target input port").selectOption("documents-in");
  await page.getByRole("button", { name: "Create compatible connection" }).click();
  await expect(page.getByTestId("mutation-message")).toContainText("Advisory connection created");
  await expect(page.locator(".react-flow__edge")).toHaveCount(9);

  await page.getByLabel("Target input port").selectOption("guarded-query-in");
  await page.getByRole("button", { name: "Create compatible connection" }).click();
  await expect(page.getByTestId("mutation-message")).toContainText("incompatible data contracts");
  await expect(page.locator(".react-flow__edge")).toHaveCount(9);

  await addedNode.click();
  await expect(page.getByTestId("node-inspector")).toContainText("Roadmap Retrieval");
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expectCanonicalCounts(page);

  await page.getByRole("button", { name: "Add roadmap component Evaluator" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(10);
  await page.getByRole("button", { name: "Reset to template" }).click();
  await expectCanonicalCounts(page);
  await expect(page.getByTestId("mutation-message")).toContainText("Canonical template restored");

  await page.getByRole("button", { name: "Add simulated database Relational database" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(10);
  await page.reload();
  await expectCanonicalCounts(page);

  const serious = (await new AxeBuilder({ page }).analyze()).violations.filter((item) =>
    ["serious", "critical"].includes(item.impact ?? ""),
  );
  expect(serious).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/ao005-orchestrator-desktop.png", fullPage: true });
});

test("configuration validation blocks unsafe architecture and accepts valid remediation", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/orchestrator");

  await expect(page.getByTestId("workflow-status")).toContainText("Ready for future execution");
  await expect(page.getByTestId("workflow-status")).toContainText("0 errors");
  await expect(page.getByTestId("workflow-status")).toContainText("1 warnings");

  await page.getByRole("button", { name: "Select Citation-Aware Retrieval" }).click();
  const topK = page.getByLabel(/^Top K/);
  await topK.fill("0");
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.locator(".error-summary")).toContainText("configuration.topK");
  await expect(page.getByTestId("workflow-status")).toContainText("Ready for future execution");

  await topK.fill("12");
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByTestId("mutation-message")).toContainText(
    "Configuration applied atomically",
  );
  await expect(page.getByTestId("workflow-status")).toContainText("Ready for future execution");

  const citations = page.getByLabel(/^Citations required/);
  await citations.uncheck();
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByTestId("workflow-status")).toContainText("Execution readiness blocked");
  await expect(page.getByTestId("workflow-status")).toContainText("1 errors");
  await expect(page.getByText("error: CITATION_POLICY_MISMATCH")).toBeVisible();
  await expect(
    page.getByText("Enable citations on retrieval and output guardrails."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Warnings" }).click();
  await expect(page.getByText("warning: EXTERNAL_CONFIDENTIAL_DATA")).toBeVisible();
  await page.getByRole("button", { name: "Errors" }).click();
  await expect(page.getByText("error: CITATION_POLICY_MISMATCH")).toBeVisible();

  await citations.check();
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByTestId("workflow-status")).toContainText("Ready for future execution");
  await expect(page.getByTestId("workflow-status")).toContainText("0 errors");
  await page.screenshot({
    path: "test-results/ao006-configuration-validation.png",
    fullPage: true,
  });
});
test("orchestrator remains usable at a mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/orchestrator");
  await expectCanonicalCounts(page);
  await expect(
    page.getByRole("button", { name: "Add roadmap component User input" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create compatible connection" })).toBeVisible();
  const serious = (await new AxeBuilder({ page }).analyze()).violations.filter((item) =>
    ["serious", "critical"].includes(item.impact ?? ""),
  );
  expect(serious).toEqual([]);
  await page.screenshot({ path: "test-results/ao005-orchestrator-mobile.png", fullPage: true });
});
