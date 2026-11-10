// The typefaces: code in JetBrains Mono with no ligature, words in Geist (`pages.md`, Typefaces).
import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";
import { seedProgram, seedProgress, solutionOf } from "./seed";

const style = (locator: Locator) =>
  locator.evaluate((el) => {
    const computed = getComputedStyle(el);
    return { family: computed.fontFamily, features: computed.fontFeatureSettings };
  });

test("code is drawn in JetBrains Mono with no ligature, and words in Geist", async ({ page }) => {
  await seedProgress(page, { fizzbuzz: { status: "attempted", hints: 0, solution: false } });
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  const chart = page.getByTestId("chart");

  const condition = await style(chart.locator("tspan", { hasText: "%" }).first());
  expect(condition.family).toContain("JetBrains Mono");
  expect(condition.features).toContain('"calt" 0');
  expect((await style(chart.locator("tspan", { hasText: "Start" }))).family).toContain("Geist");

  const example = page.getByTestId("example");
  expect((await style(example.getByText("Output"))).family).toContain("Geist");
  expect((await style(example.getByText("Fizz").first())).family).toContain("JetBrains Mono");

  await page.locator('[data-testid="connector"][data-place="main/main/0"]').click();
  const menu = page.getByTestId("block-menu");
  expect((await style(menu.getByText("print(…)"))).family).toContain("JetBrains Mono");
  expect((await style(menu.getByText("Print", { exact: true }))).family).toContain("Geist");

  await menu.locator('[data-entry="print"]').click();
  const line = page.getByTestId("block-editor").locator("[data-value-line]").first();
  expect((await style(line)).family).toContain("JetBrains Mono");
});
