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
    value: { id: "dgn-emp0-001", type: "draft", text: "" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("chart")).toContainText("x ← value");
  await expect(page.getByTestId("red-dot")).toHaveCount(0);
});

test("a draft shows its text and no dot, until Run leads to it", async ({ page }) => {
  const assign = {
    id: "dgn-asg1-001",
    type: "assign",
    target: { id: "dgn-tgt-0003", type: "var", name: "x" },
    value: { id: "dgn-drf0-001", type: "draft", text: "1 +" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("chart")).toContainText("x ← 1 +");
  await expect(page.getByTestId("red-dot")).toHaveCount(0);
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-line").nth(1)).toHaveText("2x = 1 +");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.locator('[data-chart-node="dgn-asg1-001"]')).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.getByTestId("block-editor").getByRole("alert")).toContainText(
    "Syntax error at character 3",
  );
});
