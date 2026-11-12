// A chart node with a diagnostic shows a red dot; hovering shows the message and its fix.
import { expect, test } from "./fixtures";
import { declareFirstProgram, programWith, seedProgram, seedProgress } from "./seed";

test.beforeEach(async ({ page }) => {
  await seedProgress(page, {});
});

test("hovering a flagged chart node shows its message, and the fix applies", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", declareFirstProgram());
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("red-dot")).toHaveCount(1);
  await page.locator('[data-chart-node="dgn-prnt-001"]').hover();
  const message = page.getByTestId("diagnostic-message");
  await expect(message).toContainText("Give total a value before the if or loop");
  await message.getByRole("button", { name: "Give total a value before it" }).click();
  await expect(page.getByTestId("red-dot")).toHaveCount(0);
  await expect(page.getByTestId("chart")).toContainText("total ← None");
});

test("an empty slot shows no dot, only its hint", async ({ page }) => {
  const assign = {
    id: "dgn-asg0-001",
    type: "assign",
    target: { id: "dgn-tgt-0002", type: "var", name: "x" },
    value: { id: "dgn-emp0-001", type: "empty" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("chart")).toContainText("x ← value");
  await expect(page.getByTestId("red-dot")).toHaveCount(0);
});
